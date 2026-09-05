import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import {
  and,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { CreditsService } from '@/credits/credits.service';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { DatabaseTransaction } from '@/database/types/database-transaction.type';

import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateCreditBookingDto } from './dto/create-credit-booking.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { GetCreditAvailableSlotsDto } from './dto/get-credit-available-slots.dto';
import { BusyInterval, SlotResult } from './types/bookings.types';

type AvailabilityRecord = Awaited<ReturnType<BookingsService['findAvailabilities']>>[number];

type AvailabilityWithTime = AvailabilityRecord & {
  startTime: string;
  endTime: string;
};

function isValidAvailability(av: AvailabilityRecord): av is AvailabilityWithTime {
  return av.startTime !== null && av.endTime !== null && av.locations.length > 0;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly creditsService: CreditsService,
  ) {}

  async getAvailableSlots(dto: GetAvailableSlotsDto) {
    const bookingPackage = await this.db.query.packages.findFirst({
      where: eq(schema.packages.id, dto.packageId),
    });

    if (!bookingPackage) {
      throw new NotFoundException('Package not found');
    }

    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, bookingPackage.schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const durationMinutes =
      bookingPackage.durationMinutes >= 180 ? 60 : bookingPackage.durationMinutes;

    const timezone =
      school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;

    const startOfDayZoned = toDate(`${dto.date}T00:00:00`, {
      timeZone: timezone,
    });

    const endOfDayZoned = toDate(`${dto.date}T23:59:59.999`, {
      timeZone: timezone,
    });

    if (Number.isNaN(startOfDayZoned.getTime()) || Number.isNaN(endOfDayZoned.getTime())) {
      throw new BadRequestException(`Invalid date or school timezone: ${timezone}`);
    }

    const targetDayOfWeek = new Date(`${dto.date}T00:00:00Z`).getUTCDay();

    const rawAvailabilities = await this.findAvailabilities(
      dto,
      targetDayOfWeek,
      startOfDayZoned,
      endOfDayZoned,
    );

    const validAvailabilities = rawAvailabilities.filter(isValidAvailability);

    if (validAvailabilities.length === 0) {
      return [];
    }

    return this.calculateSlots(validAvailabilities, durationMinutes, startOfDayZoned, timezone);
  }

  private async findAvailabilities(
    dto: Pick<GetAvailableSlotsDto, 'instructorId' | 'suburb'>,
    targetDayOfWeek: number,
    startOfDayZoned: Date,
    endOfDayZoned: Date,
    db: NodePgDatabase<FullSchema> | DatabaseTransaction = this.db,
  ) {
    const startOfSearchDay = startOfDayZoned.toISOString();
    const endOfSearchDay = endOfDayZoned.toISOString();
    const normalizedSuburb = dto.suburb.trim();
    const now = new Date().toISOString();

    return db.query.availability.findMany({
      where: and(
        eq(schema.availability.instructorId, dto.instructorId),
        eq(schema.availability.dayOfWeek, targetDayOfWeek),
        eq(schema.availability.isWorking, true),
      ),
      with: {
        locations: {
          columns: {
            id: true,
          },
          where: or(
            ilike(schema.availabilityLocations.suburb, `%${normalizedSuburb}%`),
            ilike(schema.availabilityLocations.postcode, `%${normalizedSuburb}%`),
          ),
        },
        breaks: {
          columns: {
            startTime: true,
            endTime: true,
          },
        },
        instructor: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
            pricePerHour: true,
          },
          with: {
            bookings: {
              columns: {
                startDatetime: true,
                endDatetime: true,
              },
              where: and(
                lt(schema.bookings.startDatetime, endOfSearchDay),
                gt(schema.bookings.endDatetime, startOfSearchDay),
                notInArray(schema.bookings.status, ['cancelled', 'expired']),
                or(
                  ne(schema.bookings.status, 'pending'),
                  isNull(schema.bookings.paymentExpiresAt),
                  gt(schema.bookings.paymentExpiresAt, now),
                ),
              ),
            },
            availabilityBlocks: {
              columns: {
                startDatetime: true,
                endDatetime: true,
              },
              where: and(
                lt(schema.availabilityBlocks.startDatetime, endOfSearchDay),
                gt(schema.availabilityBlocks.endDatetime, startOfSearchDay),
              ),
            },
          },
        },
      },
    });
  }

  private calculateSlots(
    availabilities: AvailabilityWithTime[],
    durationMinutes: number,
    baseDate: Date,
    timezone: string,
  ): SlotResult[] {
    const availableSlots: SlotResult[] = [];
    const nowMs = Date.now();

    const dateString = formatInTimeZone(baseDate, timezone, 'yyyy-MM-dd');
    const parseTime = (timeStr: string) =>
      toDate(`${dateString}T${timeStr}`, { timeZone: timezone }).getTime();

    for (const av of availabilities) {
      const busyIntervals = this.buildBusyIntervals(av, parseTime);

      const instructorSlots = this.generateInstructorSlots(
        av,
        busyIntervals,
        durationMinutes,
        parseTime,
        nowMs,
        timezone,
      );

      availableSlots.push(...instructorSlots);
    }

    return availableSlots.sort(
      (a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime(),
    );
  }

  private buildBusyIntervals(
    av: AvailabilityRecord,
    parseTime: (t: string) => number,
  ): BusyInterval[] {
    const travelMs = av.travelTime * 60 * 1000;
    const intervals: BusyInterval[] = [];

    av.breaks.forEach((b) => {
      intervals.push({ start: parseTime(b.startTime), end: parseTime(b.endTime) });
    });

    av.instructor.availabilityBlocks.forEach((block) => {
      intervals.push({
        start: new Date(block.startDatetime).getTime(),
        end: new Date(block.endDatetime).getTime(),
      });
    });

    av.instructor.bookings.forEach((booking) => {
      intervals.push({
        start: new Date(booking.startDatetime).getTime() - travelMs,
        end: new Date(booking.endDatetime).getTime() + travelMs,
      });
    });

    return intervals;
  }

  private generateInstructorSlots(
    av: AvailabilityWithTime,
    busyIntervals: BusyInterval[],
    durationMinutes: number,
    parseTime: (t: string) => number,
    nowMs: number,
    timezone: string,
  ): SlotResult[] {
    const slots: SlotResult[] = [];
    const durationMs = durationMinutes * 60 * 1000;
    const slotIntervalMs = av.slotInterval * 60 * 1000;

    const endOfDayMs = parseTime(av.endTime);
    let currentMs = parseTime(av.startTime);

    while (currentMs + durationMs <= endOfDayMs) {
      const slotStart = currentMs;
      const slotEnd = currentMs + durationMs;

      const isFuture = slotStart > nowMs;
      const hasOverlap = busyIntervals.some((busy) => slotStart < busy.end && slotEnd > busy.start);

      if (isFuture && !hasOverlap) {
        slots.push({
          instructorId: av.instructorId,
          instructor: {
            name: av.instructor.name,
            avatarUrl: av.instructor.avatarUrl,
            pricePerHour: av.instructor.pricePerHour,
          },
          startDatetime: new Date(slotStart).toISOString(),
          endDatetime: new Date(slotEnd).toISOString(),
          startTime: formatInTimeZone(new Date(slotStart), timezone, 'h:mm a'),
          endTime: formatInTimeZone(new Date(slotEnd), timezone, 'h:mm a'),
        });
      }

      currentMs += slotIntervalMs;
    }

    return slots;
  }

  async createBooking(userId: string, schoolId: string, dto: CreateBookingDto) {
    return this.db.transaction(async (tx) => {
      await this.lockBookingOperation(tx, `booking-student:${schoolId}:${userId}`);

      await this.lockBookingOperation(tx, `booking-instructor:${dto.instructorId}`);

      const bookingPackage = await tx.query.packages.findFirst({
        where: and(eq(schema.packages.id, dto.packageId), eq(schema.packages.schoolId, schoolId)),
      });

      if (!bookingPackage) {
        throw new NotFoundException('Package not found');
      }

      const student = await tx.query.students.findFirst({
        columns: {
          id: true,
        },
        where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const existingBooking = await tx.query.bookings.findFirst({
        columns: {
          id: true,
        },
        where: and(
          eq(schema.bookings.studentId, student.id),
          eq(schema.bookings.schoolId, schoolId),
        ),
      });

      const isFirstBooking = !existingBooking;

      const pickupAddress = dto.pickupAddress.trim();
      const pickupSuburb = dto.pickupSuburb.trim();
      const pickupPostcode = dto.pickupPostcode?.trim() || null;
      const pickupGooglePlaceId = dto.pickupGooglePlaceId?.trim() || null;

      if (!pickupAddress || !pickupSuburb) {
        throw new BadRequestException('Pickup address and suburb are required');
      }

      const pickupCoordinates = sql`
      ST_SetSRID(
        ST_MakePoint(${dto.pickupLongitude}, ${dto.pickupLatitude}),
        4326
      )
    `;

      const startDatetime = new Date(dto.startDatetime);

      if (Number.isNaN(startDatetime.getTime())) {
        throw new BadRequestException('Invalid booking start datetime');
      }

      if (startDatetime.getTime() <= Date.now()) {
        throw new BadRequestException('Booking must be in the future');
      }

      const initialBookingMinutes =
        bookingPackage.durationMinutes >= 180 ? 60 : bookingPackage.durationMinutes;

      const endDatetime = new Date(startDatetime.getTime() + initialBookingMinutes * 60 * 1000);

      const now = new Date().toISOString();

      const overlappingBooking = await tx.query.bookings.findFirst({
        columns: {
          id: true,
        },
        where: and(
          eq(schema.bookings.instructorId, dto.instructorId),
          notInArray(schema.bookings.status, ['cancelled', 'expired']),
          or(
            ne(schema.bookings.status, 'pending'),
            isNull(schema.bookings.paymentExpiresAt),
            gt(schema.bookings.paymentExpiresAt, now),
          ),
          lt(schema.bookings.startDatetime, endDatetime.toISOString()),
          gt(schema.bookings.endDatetime, startDatetime.toISOString()),
        ),
      });

      if (overlappingBooking) {
        throw new BadRequestException(
          'This slot has just been booked by someone else. Please choose another time.',
        );
      }

      const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const [newBooking] = await tx
        .insert(schema.bookings)
        .values({
          schoolId,
          studentId: student.id,
          instructorId: dto.instructorId,
          packageId: dto.packageId,
          bookingSource: 'package',
          pickupAddress,
          pickupSuburb,
          pickupPostcode,
          pickupCoordinates,
          pickupGooglePlaceId,
          startDatetime: startDatetime.toISOString(),
          endDatetime: endDatetime.toISOString(),
          totalPrice: bookingPackage.price,
          notes: dto.notes,
          status: 'pending',
          paymentExpiresAt,
        })
        .returning();

      if (isFirstBooking) {
        await tx
          .update(schema.students)
          .set({
            address: pickupAddress,
            addressSuburb: pickupSuburb,
            addressPostcode: pickupPostcode,
            addressCoordinates: pickupCoordinates,
            addressGooglePlaceId: pickupGooglePlaceId,
          })
          .where(and(eq(schema.students.id, student.id), eq(schema.students.schoolId, schoolId)));
      }

      return newBooking;
    });
  }

  private async lockBookingOperation(tx: DatabaseTransaction, key: string): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  private async getExistingCreditBookingResult(
    tx: DatabaseTransaction,
    schoolId: string,
    studentId: string,
    dto: CreateCreditBookingDto,
    startDatetime: Date,
    endDatetime: Date,
    idempotencyKey: string,
  ) {
    const existingTransaction = await tx.query.studentCreditTransactions.findFirst({
      where: and(
        eq(schema.studentCreditTransactions.idempotencyKey, idempotencyKey),
        eq(schema.studentCreditTransactions.schoolId, schoolId),
        eq(schema.studentCreditTransactions.studentId, studentId),
        eq(schema.studentCreditTransactions.type, 'booking_use'),
      ),
    });

    if (!existingTransaction) {
      return null;
    }

    if (!existingTransaction.bookingId) {
      throw new ConflictException(
        'This request has already been processed, but its booking is unavailable',
      );
    }

    const booking = await tx.query.bookings.findFirst({
      where: and(
        eq(schema.bookings.id, existingTransaction.bookingId),
        eq(schema.bookings.schoolId, schoolId),
        eq(schema.bookings.studentId, studentId),
      ),
    });

    if (!booking) {
      throw new ConflictException('Previously created booking is unavailable');
    }

    const matchesRequest =
      booking.bookingSource === 'credit' &&
      booking.instructorId === dto.instructorId &&
      new Date(booking.startDatetime).getTime() === startDatetime.getTime() &&
      new Date(booking.endDatetime).getTime() === endDatetime.getTime() &&
      existingTransaction.deltaMinutes === -dto.durationMinutes &&
      booking.notes === (dto.notes ?? null);

    if (!matchesRequest) {
      throw new ConflictException(
        'This idempotency key has already been used for a different booking request',
      );
    }

    const balance = await tx.query.studentCreditBalances.findFirst({
      columns: {
        balanceMinutes: true,
      },
      where: and(
        eq(schema.studentCreditBalances.schoolId, schoolId),
        eq(schema.studentCreditBalances.studentId, studentId),
      ),
    });

    return {
      booking,
      balanceMinutes: balance?.balanceMinutes ?? 0,
    };
  }

  async getCreditAvailableSlots(
    userId: string,
    schoolId: string,
    dto: GetCreditAvailableSlotsDto,
    db: NodePgDatabase<FullSchema> | DatabaseTransaction = this.db,
  ): Promise<SlotResult[]> {
    const student = await db.query.students.findFirst({
      columns: {
        id: true,
        addressSuburb: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school');
    }

    const pickupSuburb = student.addressSuburb?.trim();

    if (!pickupSuburb) {
      throw new BadRequestException('Student does not have a saved pickup suburb');
    }

    const school = await db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const instructorMembership = await db.query.instructorSchools.findFirst({
      where: and(
        eq(schema.instructorSchools.instructorId, dto.instructorId),
        eq(schema.instructorSchools.schoolId, schoolId),
        eq(schema.instructorSchools.status, 'accepted'),
      ),
    });

    if (!instructorMembership) {
      throw new NotFoundException('Instructor is not available in this school');
    }

    const timezone =
      school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;

    const startOfDayZoned = toDate(`${dto.date}T00:00:00`, {
      timeZone: timezone,
    });

    const endOfDayZoned = toDate(`${dto.date}T23:59:59.999`, {
      timeZone: timezone,
    });

    if (Number.isNaN(startOfDayZoned.getTime()) || Number.isNaN(endOfDayZoned.getTime())) {
      throw new BadRequestException(`Invalid date or school timezone: ${timezone}`);
    }

    const targetDayOfWeek = new Date(`${dto.date}T00:00:00Z`).getUTCDay();

    const rawAvailabilities = await this.findAvailabilities(
      {
        instructorId: dto.instructorId,
        suburb: pickupSuburb,
      },
      targetDayOfWeek,
      startOfDayZoned,
      endOfDayZoned,
      db,
    );

    const validAvailabilities = rawAvailabilities.filter(isValidAvailability);

    return this.calculateSlots(validAvailabilities, dto.durationMinutes, startOfDayZoned, timezone);
  }

  async createCreditBooking(userId: string, schoolId: string, dto: CreateCreditBookingDto) {
    const startDatetime = new Date(dto.startDatetime);

    if (Number.isNaN(startDatetime.getTime())) {
      throw new BadRequestException('Invalid booking start datetime');
    }

    if (
      !Number.isInteger(dto.durationMinutes) ||
      dto.durationMinutes < 60 ||
      dto.durationMinutes > 180 ||
      dto.durationMinutes % 15 !== 0
    ) {
      throw new BadRequestException(
        'Lesson duration must be between 60 and 180 minutes in 15-minute increments',
      );
    }

    const endDatetime = new Date(startDatetime.getTime() + dto.durationMinutes * 60 * 1000);

    return this.db.transaction(async (tx) => {
      const student = await tx.query.students.findFirst({
        columns: {
          id: true,
          address: true,
          addressSuburb: true,
          addressPostcode: true,
          addressCoordinates: true,
          addressGooglePlaceId: true,
        },
        where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
      });

      if (!student) {
        throw new NotFoundException('Student not found for this school');
      }

      const pickupAddress = student.address?.trim();
      const pickupSuburb = student.addressSuburb?.trim();
      const pickupPostcode = student.addressPostcode?.trim() || null;
      const pickupCoordinates = student.addressCoordinates;
      const pickupGooglePlaceId = student.addressGooglePlaceId?.trim() || null;

      if (!pickupAddress || !pickupSuburb || !pickupCoordinates) {
        throw new BadRequestException('Student does not have a complete saved pickup address');
      }

      const idempotencyKey = `credit-booking:${schoolId}:${student.id}:${dto.idempotencyKey}`;

      await this.lockBookingOperation(tx, idempotencyKey);

      const existingResult = await this.getExistingCreditBookingResult(
        tx,
        schoolId,
        student.id,
        dto,
        startDatetime,
        endDatetime,
        idempotencyKey,
      );

      if (existingResult) {
        return existingResult;
      }

      await this.lockBookingOperation(tx, `booking-instructor:${dto.instructorId}`);

      if (startDatetime.getTime() <= Date.now()) {
        throw new BadRequestException('Booking must be in the future');
      }

      const school = await tx.query.schools.findFirst({
        where: eq(schema.schools.id, schoolId),
      });

      if (!school) {
        throw new NotFoundException('School not found');
      }

      const timezone =
        school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;

      const creditSource = await tx.query.studentCreditTransactions.findFirst({
        where: and(
          eq(schema.studentCreditTransactions.schoolId, schoolId),
          eq(schema.studentCreditTransactions.studentId, student.id),
          eq(schema.studentCreditTransactions.type, 'package_credit'),
          gt(schema.studentCreditTransactions.deltaMinutes, 0),
          isNotNull(schema.studentCreditTransactions.packagePurchaseId),
        ),
        orderBy: [desc(schema.studentCreditTransactions.createdAt)],
        with: {
          packagePurchase: {
            columns: {
              id: true,
              packageId: true,
              status: true,
            },
          },
        },
      });

      if (!creditSource?.packagePurchase) {
        throw new BadRequestException('Credit is not associated with a package purchase');
      }

      const packagePurchase = creditSource.packagePurchase;

      if (packagePurchase.status !== 'paid') {
        throw new BadRequestException('Credit package purchase is not paid');
      }

      const availableSlots = await this.getCreditAvailableSlots(
        userId,
        schoolId,
        {
          instructorId: dto.instructorId,
          suburb: pickupSuburb,
          date: formatInTimeZone(startDatetime, timezone, 'yyyy-MM-dd'),
          durationMinutes: dto.durationMinutes,
        },
        tx,
      );

      const selectedSlot = availableSlots.find(
        (slot) =>
          new Date(slot.startDatetime).getTime() === startDatetime.getTime() &&
          new Date(slot.endDatetime).getTime() === endDatetime.getTime(),
      );

      if (!selectedSlot) {
        throw new ConflictException(
          'This time is no longer available. Please choose another slot.',
        );
      }

      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          schoolId,
          studentId: student.id,
          instructorId: dto.instructorId,

          bookingSource: 'credit',

          packageId: packagePurchase.packageId,
          packagePurchaseId: packagePurchase.id,

          pickupAddress,
          pickupSuburb,
          pickupPostcode,
          pickupCoordinates,
          pickupGooglePlaceId,

          startDatetime: selectedSlot.startDatetime,
          endDatetime: selectedSlot.endDatetime,

          totalPrice: '0.00',
          notes: dto.notes ?? null,

          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          paymentExpiresAt: null,
        })
        .returning();

      const balanceMinutes = await this.creditsService.useCreditInTransaction(tx, {
        schoolId,
        studentId: student.id,
        bookingId: booking.id,
        minutes: dto.durationMinutes,
        idempotencyKey,
      });

      return {
        booking,
        balanceMinutes,
      };
    });
  }
}
