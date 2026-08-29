import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

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
      const account = await stripe.accounts.create({
        type: 'standard',
        email: school.email ?? undefined,
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

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
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
