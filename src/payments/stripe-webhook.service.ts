import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type Stripe from 'stripe';

import * as schema from '@/database/schema';
import { CreditsService } from '@/credits/credits.service';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { StripeService } from '@/stripe/stripe.service';

import { PaymentRecord } from './types/payment-record.type';

@Injectable()
export class StripeWebhookService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly creditsService: CreditsService,
  ) {}

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_CONNECT_WEBHOOK_SECRET is missing');
    }

    try {
      return this.stripeService
        .getClient()
        .webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (!event.account) {
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object, event.account);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object, event.account);
        break;
    }
  }

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    stripeAccountId: string,
  ): Promise<void> {
    const payment = await this.findPayment(paymentIntent.id, stripeAccountId);

    const purchase = await this.db.query.packagePurchases.findFirst({
      where: eq(schema.packagePurchases.id, payment.packagePurchaseId),
    });

    if (!purchase) {
      throw new InternalServerErrorException('Package purchase not found');
    }

    const booking = await this.db.query.bookings.findFirst({
      where: and(
        eq(schema.bookings.packagePurchaseId, purchase.id),
        eq(schema.bookings.bookingSource, 'package'),
      ),
    });

    if (!booking) {
      throw new InternalServerErrorException('Booking not found for package purchase');
    }

    const paidAt = new Date().toISOString();

    const usedMinutes = Math.round(
      (new Date(booking.endDatetime).getTime() - new Date(booking.startDatetime).getTime()) /
        60_000,
    );

    const creditMinutes = purchase.purchasedMinutes - usedMinutes;

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.payments)
        .set({
          status: 'paid',
          paidAt,
          failureMessage: null,
        })
        .where(eq(schema.payments.id, payment.id));

      await tx
        .update(schema.packagePurchases)
        .set({
          status: 'paid',
          paidAt,
        })
        .where(eq(schema.packagePurchases.id, purchase.id));

      await tx
        .update(schema.bookings)
        .set({
          status: 'confirmed',
          confirmedAt: paidAt,
          paymentExpiresAt: null,
        })
        .where(eq(schema.bookings.id, booking.id));

      if (creditMinutes > 0) {
        await this.creditsService.addCreditInTransaction(tx, {
          schoolId: purchase.schoolId,
          studentId: purchase.studentId,
          packagePurchaseId: purchase.id,
          bookingId: booking.id,
          minutes: creditMinutes,
          type: 'package_credit',
          idempotencyKey: `package-credit:${purchase.id}`,
        });
      }
    });
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
    stripeAccountId: string,
  ): Promise<void> {
    const payment = await this.findPayment(paymentIntent.id, stripeAccountId);

    await this.db
      .update(schema.payments)
      .set({
        status: 'failed',
        failureMessage: paymentIntent.last_payment_error?.message ?? 'Payment failed',
      })
      .where(eq(schema.payments.id, payment.id));
  }

  private async findPayment(
    paymentIntentId: string,
    stripeAccountId: string,
  ): Promise<PaymentRecord> {
    const payment = await this.db.query.payments.findFirst({
      where: and(
        eq(schema.payments.stripePaymentIntentId, paymentIntentId),
        eq(schema.payments.stripeAccountId, stripeAccountId),
      ),
    });

    if (!payment) {
      throw new InternalServerErrorException('Payment record not found');
    }

    return payment;
  }
}
