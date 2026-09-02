import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { StripeService } from '@/stripe/stripe.service';

@Injectable()
export class PaymentExpirationService {
  private readonly logger = new Logger(PaymentExpirationService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly stripeService: StripeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingPayments(): Promise<void> {
    const now = new Date().toISOString();

    const expiredBookings = await this.db.query.bookings.findMany({
      columns: {
        id: true,
      },
      where: and(
        eq(schema.bookings.status, 'pending'),
        isNotNull(schema.bookings.paymentExpiresAt),
        lte(schema.bookings.paymentExpiresAt, now),
      ),
      limit: 50,
    });

    for (const booking of expiredBookings) {
      try {
        await this.expireBooking(booking.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown expiration error';

        this.logger.error(`Failed to expire booking ${booking.id}: ${message}`);
      }
    }
  }

  private async expireBooking(bookingId: string): Promise<void> {
    const booking = await this.db.query.bookings.findFirst({
      columns: {
        id: true,
        status: true,
        paymentExpiresAt: true,
        packagePurchaseId: true,
      },
      where: eq(schema.bookings.id, bookingId),
    });

    if (!booking) {
      return;
    }

    if (booking.status !== 'pending') {
      return;
    }

    if (!booking.paymentExpiresAt) {
      return;
    }

    if (new Date(booking.paymentExpiresAt).getTime() > Date.now()) {
      return;
    }

    if (!booking.packagePurchaseId) {
      await this.markBookingExpired(booking.id);
      return;
    }

    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.packagePurchaseId, booking.packagePurchaseId),
    });

    if (!payment) {
      await this.finalizeExpiration(booking.id, booking.packagePurchaseId);

      return;
    }

    await this.handleStripePayment(
      booking.id,
      booking.packagePurchaseId,
      payment.id,
      payment.stripePaymentIntentId,
      payment.stripeAccountId,
    );
  }

  private async handleStripePayment(
    bookingId: string,
    packagePurchaseId: string,
    paymentId: string,
    paymentIntentId: string,
    stripeAccountId: string,
  ): Promise<void> {
    const stripe = this.stripeService.getClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      {
        stripeAccount: stripeAccountId,
      },
    );

    if (paymentIntent.status === 'succeeded') {
      return;
    }

    if (paymentIntent.status === 'processing') {
      return;
    }

    if (paymentIntent.status === 'canceled') {
      await this.finalizeExpiration(bookingId, packagePurchaseId, paymentId);

      return;
    }

    try {
      await stripe.paymentIntents.cancel(
        paymentIntentId,
        {
          cancellation_reason: 'abandoned',
        },
        {
          stripeAccount: stripeAccountId,
        },
      );
    } catch (error: unknown) {
      await this.handleCancellationRace(
        bookingId,
        packagePurchaseId,
        paymentId,
        paymentIntentId,
        stripeAccountId,
        error,
      );

      return;
    }

    await this.finalizeExpiration(bookingId, packagePurchaseId, paymentId);
  }

  private async handleCancellationRace(
    bookingId: string,
    packagePurchaseId: string,
    paymentId: string,
    paymentIntentId: string,
    stripeAccountId: string,
    originalError: unknown,
  ): Promise<void> {
    const stripe = this.stripeService.getClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      {
        stripeAccount: stripeAccountId,
      },
    );

    if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
      return;
    }

    if (paymentIntent.status === 'canceled') {
      await this.finalizeExpiration(bookingId, packagePurchaseId, paymentId);

      return;
    }

    throw originalError;
  }

  private async markBookingExpired(bookingId: string): Promise<void> {
    await this.db
      .update(schema.bookings)
      .set({
        status: 'expired',
        paymentExpiresAt: null,
      })
      .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, 'pending')));
  }

  private async finalizeExpiration(
    bookingId: string,
    packagePurchaseId: string,
    paymentId?: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.bookings)
        .set({
          status: 'expired',
          paymentExpiresAt: null,
        })
        .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, 'pending')));

      await tx
        .update(schema.packagePurchases)
        .set({
          status: 'expired',
        })
        .where(
          and(
            eq(schema.packagePurchases.id, packagePurchaseId),
            eq(schema.packagePurchases.status, 'pending'),
          ),
        );

      if (paymentId) {
        await tx
          .update(schema.payments)
          .set({
            status: 'cancelled',
          })
          .where(eq(schema.payments.id, paymentId));
      }
    });
  }
}
