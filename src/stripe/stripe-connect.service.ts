import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { StripeService } from './stripe.service';

@Injectable()
export class StripeConnectService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
  ) {}

  async createOnboardingLink(schoolId: string) {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const stripe = this.stripeService.getClient();

    let stripeAccountId = school.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: school.email ?? undefined,
        display_name: school.name,

        identity: {
          country: 'AU',
        },

        dashboard: 'full',

        configuration: {
          merchant: {
            capabilities: {
              card_payments: {
                requested: true,
              },
            },
          },
        },

        defaults: {
          currency: 'aud',
          responsibilities: {
            fees_collector: 'stripe',
            losses_collector: 'stripe',
          },
        },

        metadata: {
          schoolId,
        },
      });

      stripeAccountId = account.id;

      await this.db
        .update(schema.schools)
        .set({
          stripeAccountId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.schools.id, schoolId));
    }

    const refreshUrl = this.configService.get<string>('STRIPE_CONNECT_REFRESH_URL');
    const returnUrl = this.configService.get<string>('STRIPE_CONNECT_RETURN_URL');

    if (!refreshUrl || !returnUrl) {
      throw new Error('Stripe Connect URLs are missing');
    }

    const accountLink = await stripe.v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant'],
          refresh_url: refreshUrl,
          return_url: returnUrl,
          collection_options: {
            fields: 'eventually_due',
          },
        },
      },
    });

    return {
      url: accountLink.url,
    };
  }

  async getAccountStatus(schoolId: string) {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (!school.stripeAccountId) {
      return {
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const stripe = this.stripeService.getClient();

    const account = await stripe.accounts.retrieve(school.stripeAccountId);

    await this.db
      .update(schema.schools)
      .set({
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.schools.id, schoolId));

    return {
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }
}
