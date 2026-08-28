import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { and, eq, gt, ilike, lt, ne, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

import { CreateBookingDto } from './dto/create-booking.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
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

    const durationMinutes = bookingPackage.durationMinutes;

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
    dto: GetAvailableSlotsDto,
    targetDayOfWeek: number,
    startOfDayZoned: Date,
    endOfDayZoned: Date,
  ) {
    const startOfSearchDay = startOfDayZoned.toISOString();
    const endOfSearchDay = endOfDayZoned.toISOString();
    const normalizedSuburb = dto.suburb.trim();

    return this.db.query.availability.findMany({
      where: and(
        eq(schema.availability.instructorId, dto.instructorId),
        eq(schema.availability.dayOfWeek, targetDayOfWeek),
        eq(schema.availability.isWorking, true),
      ),
      with: {
        locations: {
          where: or(
            ilike(schema.availabilityLocations.suburb, `%${normalizedSuburb}%`),
            ilike(schema.availabilityLocations.postcode, `%${normalizedSuburb}%`),
          ),
        },
        breaks: true,
        instructor: {
          with: {
            bookings: {
              where: and(
                lt(schema.bookings.startDatetime, endOfSearchDay),
                gt(schema.bookings.endDatetime, startOfSearchDay),
                ne(schema.bookings.status, 'cancelled'),
              ),
            },
            availabilityBlocks: {
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
    const bookingPackage = await this.db.query.packages.findFirst({
      where: and(eq(schema.packages.id, dto.packageId), eq(schema.packages.schoolId, schoolId)),
    });

    if (!bookingPackage) {
      throw new NotFoundException('Package not found');
    }

    const student = await this.db.query.students.findFirst({
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const overlappingBooking = await this.db.query.bookings.findFirst({
      where: and(
        eq(schema.bookings.instructorId, dto.instructorId),
        ne(schema.bookings.status, 'cancelled'),
        lt(schema.bookings.startDatetime, dto.endDatetime),
        gt(schema.bookings.endDatetime, dto.startDatetime),
      ),
    });

    if (overlappingBooking) {
      throw new BadRequestException(
        'This slot has just been booked by someone else. Please choose another time.',
      );
    }

    const [newBooking] = await this.db
      .insert(schema.bookings)
      .values({
        schoolId,
        studentId: student.id,
        instructorId: dto.instructorId,
        packageId: dto.packageId,
        pickupSuburb: dto.pickupSuburb,
        pickupPostcode: dto.pickupPostcode,
        startDatetime: dto.startDatetime,
        endDatetime: dto.endDatetime,
        totalPrice: bookingPackage.price,
        notes: dto.notes,
        status: 'pending',
      })
      .returning();

    return newBooking;
  }
}
