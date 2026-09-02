import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { StripeConnectService } from '@/stripe/stripe-connect.service';
import { StripeService } from '@/stripe/stripe.service';

import { CreatePackagePaymentDto } from './dto/create-package-payment.dto';
import { CreatePackagePaymentResult } from './interfaces/create-package-payment-result.interface';
import { CreateStripePaymentIntentInput } from './interfaces/create-stripe-payment-intent-input.interface';
import { PackagePaymentStatus } from './interfaces/package-payment-status.interface';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  async createPackagePayment(
    userId: string,
    schoolId: string,
    dto: CreatePackagePaymentDto,
  ): Promise<CreatePackagePaymentResult> {
    const student = await this.getStudent(userId, schoolId);

    const booking = await this.getBooking(dto.bookingId, schoolId, student.id);

    this.validateBookingForPayment(booking);

    const packageId = booking.packageId;
    const totalAmount = booking.totalPrice;
    const paymentExpiresAt = booking.paymentExpiresAt;

    if (!packageId || !totalAmount || !paymentExpiresAt) {
      throw new BadRequestException('Booking payment data is incomplete');
    }

    const bookingPackage = await this.getPackage(packageId, schoolId);

    const school = await this.getSchool(schoolId);

    const stripeAccountId = school.stripeAccountId;

    if (!stripeAccountId) {
      throw new BadRequestException('School has not connected a Stripe account');
    }

    await this.ensureStripeAccountCanAcceptPayments(schoolId);

    const packagePurchase = await this.getOrCreatePackagePurchase(
      booking.id,
      schoolId,
      student.id,
      packageId,
      bookingPackage.durationMinutes,
      totalAmount,
    );

    this.validatePackagePurchase(packagePurchase.status);

    const existingPayment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.packagePurchaseId, packagePurchase.id),
    });

    if (existingPayment) {
      return this.getExistingPaymentResult(
        booking.id,
        packagePurchase.id,
        paymentExpiresAt,
        stripeAccountId,
        existingPayment,
      );
    }

    return this.createStripePaymentIntent({
      bookingId: booking.id,
      studentId: student.id,
      schoolId,
      packageId: bookingPackage.id,
      packageName: bookingPackage.name,
      packagePurchaseId: packagePurchase.id,
      totalAmount: packagePurchase.totalAmount,
      currency: packagePurchase.currency,
      expiresAt: paymentExpiresAt,
      stripeAccountId,
    });
  }

  private async getStudent(userId: string, schoolId: string) {
    const student = await this.db.query.students.findFirst({
      columns: {
        id: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  private async getBooking(bookingId: string, schoolId: string, studentId: string) {
    const booking = await this.db.query.bookings.findFirst({
      columns: {
        id: true,
        packageId: true,
        packagePurchaseId: true,
        status: true,
        totalPrice: true,
        paymentExpiresAt: true,
      },
      where: and(
        eq(schema.bookings.id, bookingId),
        eq(schema.bookings.schoolId, schoolId),
        eq(schema.bookings.studentId, studentId),
      ),
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private validateBookingForPayment(
    booking: Awaited<ReturnType<PaymentsService['getBooking']>>,
  ): void {
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    if (!booking.packageId) {
      throw new BadRequestException('Booking is not associated with a package');
    }

    if (!booking.paymentExpiresAt) {
      throw new BadRequestException('Booking does not have an active payment hold');
    }

    if (new Date(booking.paymentExpiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('Booking payment hold has expired');
    }

    if (!booking.totalPrice) {
      throw new BadRequestException('Booking does not have a payment amount');
    }
  }

  private async getPackage(packageId: string, schoolId: string) {
    const bookingPackage = await this.db.query.packages.findFirst({
      where: and(eq(schema.packages.id, packageId), eq(schema.packages.schoolId, schoolId)),
    });

    if (!bookingPackage) {
      throw new NotFoundException('Package not found');
    }

    return bookingPackage;
  }

  private async getSchool(schoolId: string) {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }

  private async ensureStripeAccountCanAcceptPayments(schoolId: string): Promise<void> {
    const status = await this.stripeConnectService.getAccountStatus(schoolId);

    if (!status.connected || !status.chargesEnabled) {
      throw new BadRequestException('School Stripe account is not ready to accept payments');
    }
  }

  private async getOrCreatePackagePurchase(
    bookingId: string,
    schoolId: string,
    studentId: string,
    packageId: string,
    purchasedMinutes: number,
    totalAmount: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE
      `);

      const lockedBooking = await tx.query.bookings.findFirst({
        columns: {
          status: true,
          paymentExpiresAt: true,
          packagePurchaseId: true,
        },
        where: eq(schema.bookings.id, bookingId),
      });

      if (!lockedBooking) {
        throw new NotFoundException('Booking not found');
      }

      if (lockedBooking.status !== 'pending') {
        throw new BadRequestException('Booking is not awaiting payment');
      }

      if (
        !lockedBooking.paymentExpiresAt ||
        new Date(lockedBooking.paymentExpiresAt).getTime() <= Date.now()
      ) {
        throw new BadRequestException('Booking payment hold has expired');
      }

      if (lockedBooking.packagePurchaseId) {
        const existingPurchase = await tx.query.packagePurchases.findFirst({
          where: eq(schema.packagePurchases.id, lockedBooking.packagePurchaseId),
        });

        if (!existingPurchase) {
          throw new InternalServerErrorException('Package purchase record not found');
        }

        return existingPurchase;
      }

      const [newPurchase] = await tx
        .insert(schema.packagePurchases)
        .values({
          schoolId,
          studentId,
          packageId,
          purchasedMinutes,
          totalAmount,
          currency: 'aud',
          status: 'pending',
        })
        .returning();

      if (!newPurchase) {
        throw new InternalServerErrorException('Failed to create package purchase');
      }

      await tx
        .update(schema.bookings)
        .set({
          packagePurchaseId: newPurchase.id,
        })
        .where(eq(schema.bookings.id, bookingId));

      return newPurchase;
    });
  }

  private validatePackagePurchase(status: string): void {
    if (status === 'expired' || status === 'failed') {
      throw new BadRequestException('Package purchase is no longer payable');
    }
  }

  private async getExistingPaymentResult(
    bookingId: string,
    packagePurchaseId: string,
    expiresAt: string,
    stripeAccountId: string,
    existingPayment: typeof schema.payments.$inferSelect,
  ): Promise<CreatePackagePaymentResult> {
    if (existingPayment.status === 'cancelled') {
      throw new BadRequestException('Payment is no longer available');
    }

    const stripe = this.stripeService.getClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(
      existingPayment.stripePaymentIntentId,
      {},
      {
        stripeAccount: stripeAccountId,
      },
    );

    return {
      bookingId,
      packagePurchaseId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      stripeAccountId,
      status: paymentIntent.status,
      expiresAt,
    };
  }

  private async createStripePaymentIntent(
    input: CreateStripePaymentIntentInput,
  ): Promise<CreatePackagePaymentResult> {
    const stripe = this.stripeService.getClient();

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: this.toMinorUnits(input.totalAmount),
        currency: input.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        description: input.packageName,
        metadata: {
          schoolId: input.schoolId,
          studentId: input.studentId,
          bookingId: input.bookingId,
          packageId: input.packageId,
          packagePurchaseId: input.packagePurchaseId,
        },
      },
      {
        stripeAccount: input.stripeAccountId,
        idempotencyKey: `package-purchase:${input.packagePurchaseId}`,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new InternalServerErrorException('Stripe did not return a client secret');
    }

    await this.db
      .insert(schema.payments)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        packagePurchaseId: input.packagePurchaseId,
        amount: input.totalAmount,
        currency: input.currency,
        status: 'pending',
        stripeAccountId: input.stripeAccountId,
        stripePaymentIntentId: paymentIntent.id,
      })
      .onConflictDoNothing({
        target: schema.payments.stripePaymentIntentId,
      });

    return {
      bookingId: input.bookingId,
      packagePurchaseId: input.packagePurchaseId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      stripeAccountId: input.stripeAccountId,
      status: paymentIntent.status,
      expiresAt: input.expiresAt,
    };
  }

  private toMinorUnits(amount: string): number {
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException('Invalid payment amount');
    }

    const [wholePart, decimalPart = ''] = amount.split('.');

    const minorUnits = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, '0'));

    if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    return minorUnits;
  }

  async getPackagePaymentStatus(
    userId: string,
    schoolId: string,
    bookingId: string,
  ): Promise<PackagePaymentStatus> {
    const student = await this.getStudent(userId, schoolId);

    const booking = await this.getBooking(bookingId, schoolId, student.id);

    if (!booking.packagePurchaseId) {
      return {
        bookingId: booking.id,
        bookingStatus: booking.status,
        paymentStatus: null,
      };
    }

    const payment = await this.db.query.payments.findFirst({
      where: and(
        eq(schema.payments.packagePurchaseId, booking.packagePurchaseId),
        eq(schema.payments.schoolId, schoolId),
        eq(schema.payments.studentId, student.id),
      ),
    });

    return {
      bookingId: booking.id,
      bookingStatus: booking.status,
      paymentStatus: payment?.status ?? null,
    };
  }
}
