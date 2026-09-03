import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { and, eq, gt, ilike, isNull, lt, ne, notInArray, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import type { BusyInterval } from './types/bookings.types';
import type {
  CreditAvailabilityDay,
  CreditAvailabilityQuery,
  CreditAvailabilitySlot,
  MonthAvailabilityRecord,
} from './types/credit-booking-availability.types';

@Injectable()
export class CreditBookingAvailabilityService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getAvailability(
    userId: string,
    schoolId: string,
    query: CreditAvailabilityQuery,
  ): Promise<CreditAvailabilityDay[]> {
    this.validateMonth(query.month);
    this.validateDuration(query.durationMinutes);

    const student = await this.db.query.students.findFirst({
      columns: {
        id: true,
        addressSuburb: true,
        addressPostcode: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school');
    }

    const pickupSuburb = student.addressSuburb?.trim();
    const pickupPostcode = student.addressPostcode?.trim() || null;

    if (!pickupSuburb) {
      throw new BadRequestException('Student does not have a saved pickup suburb');
    }

    const school = await this.db.query.schools.findFirst({
      columns: {
        id: true,
        timezone: true,
      },
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const instructorMembership = await this.db.query.instructorSchools.findFirst({
      columns: {
        instructorId: true,
      },
      where: and(
        eq(schema.instructorSchools.instructorId, query.instructorId),
        eq(schema.instructorSchools.schoolId, schoolId),
        eq(schema.instructorSchools.status, 'accepted'),
      ),
    });

    if (!instructorMembership) {
      throw new NotFoundException('Instructor is not available in this school');
    }

    const timezone =
      school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;

    const monthRange = this.getMonthRange(query.month, timezone);

    const availabilities = await this.findMonthAvailabilities({
      instructorId: query.instructorId,
      pickupSuburb,
      pickupPostcode,
      startOfMonth: monthRange.startOfMonth,
      endOfMonth: monthRange.endOfMonth,
    });

    if (availabilities.length === 0) {
      return [];
    }

    const availabilitiesByDay = this.groupAvailabilitiesByDay(availabilities);

    return this.buildAvailabilityDays(
      availabilitiesByDay,
      monthRange.monthPrefix,
      monthRange.daysInMonth,
      timezone,
      query.durationMinutes,
    );
  }

  private async findMonthAvailabilities({
    instructorId,
    pickupSuburb,
    pickupPostcode,
    startOfMonth,
    endOfMonth,
  }: {
    instructorId: string;
    pickupSuburb: string;
    pickupPostcode: string | null;
    startOfMonth: string;
    endOfMonth: string;
  }): Promise<MonthAvailabilityRecord[]> {
    const now = new Date().toISOString();

    const locationCondition = pickupPostcode
      ? or(
          ilike(schema.availabilityLocations.suburb, `%${pickupSuburb}%`),
          ilike(schema.availabilityLocations.postcode, `%${pickupPostcode}%`),
        )
      : ilike(schema.availabilityLocations.suburb, `%${pickupSuburb}%`);

    return this.db.query.availability.findMany({
      columns: {
        instructorId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        slotInterval: true,
        travelTime: true,
      },
      where: and(
        eq(schema.availability.instructorId, instructorId),
        eq(schema.availability.isWorking, true),
      ),
      with: {
        locations: {
          columns: {
            id: true,
          },
          where: locationCondition,
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
          },
          with: {
            bookings: {
              columns: {
                startDatetime: true,
                endDatetime: true,
              },
              where: and(
                lt(schema.bookings.startDatetime, endOfMonth),
                gt(schema.bookings.endDatetime, startOfMonth),
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
                lt(schema.availabilityBlocks.startDatetime, endOfMonth),
                gt(schema.availabilityBlocks.endDatetime, startOfMonth),
              ),
            },
          },
        },
      },
    });
  }

  private buildAvailabilityDays(
    availabilitiesByDay: Map<number, MonthAvailabilityRecord[]>,
    monthPrefix: string,
    daysInMonth: number,
    timezone: string,
    durationMinutes: number,
  ): CreditAvailabilityDay[] {
    const result: CreditAvailabilityDay[] = [];
    const nowMs = Date.now();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthPrefix}-${String(day).padStart(2, '0')}`;

      const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

      const dayAvailabilities = availabilitiesByDay.get(dayOfWeek) ?? [];

      const slots = this.buildDaySlots(dayAvailabilities, date, timezone, durationMinutes, nowMs);

      if (slots.length > 0) {
        result.push({
          date,
          slotCount: slots.length,
          slots,
        });
      }
    }

    return result;
  }

  private buildDaySlots(
    availabilities: MonthAvailabilityRecord[],
    date: string,
    timezone: string,
    durationMinutes: number,
    nowMs: number,
  ): CreditAvailabilitySlot[] {
    const slotsByStart = new Map<number, CreditAvailabilitySlot>();

    for (const availability of availabilities) {
      if (!this.isAvailabilityValid(availability)) {
        continue;
      }

      this.collectSlotsForDay({
        availability,
        date,
        timezone,
        durationMinutes,
        nowMs,
        slotsByStart,
      });
    }

    return Array.from(slotsByStart.entries())
      .sort(([startA], [startB]) => startA - startB)
      .map(([, slot]) => slot);
  }

  private collectSlotsForDay({
    availability,
    date,
    timezone,
    durationMinutes,
    nowMs,
    slotsByStart,
  }: {
    availability: MonthAvailabilityRecord;
    date: string;
    timezone: string;
    durationMinutes: number;
    nowMs: number;
    slotsByStart: Map<number, CreditAvailabilitySlot>;
  }): void {
    if (!availability.startTime || !availability.endTime) {
      return;
    }

    if (availability.slotInterval <= 0) {
      return;
    }

    const parseTime = (time: string) =>
      toDate(`${date}T${time}`, {
        timeZone: timezone,
      }).getTime();

    const startTimeMs = parseTime(availability.startTime);
    const endTimeMs = parseTime(availability.endTime);

    if (Number.isNaN(startTimeMs) || Number.isNaN(endTimeMs) || startTimeMs >= endTimeMs) {
      return;
    }

    const busyIntervals = this.buildBusyIntervals(availability, parseTime);

    const durationMs = durationMinutes * 60 * 1000;
    const slotIntervalMs = availability.slotInterval * 60 * 1000;

    let currentMs = startTimeMs;

    while (currentMs + durationMs <= endTimeMs) {
      const slotStart = currentMs;
      const slotEnd = currentMs + durationMs;

      const hasOverlap = busyIntervals.some((busy) => slotStart < busy.end && slotEnd > busy.start);

      if (slotStart > nowMs && !hasOverlap && !slotsByStart.has(slotStart)) {
        slotsByStart.set(slotStart, {
          instructorId: availability.instructorId,
          startDatetime: new Date(slotStart).toISOString(),
          endDatetime: new Date(slotEnd).toISOString(),
          startTime: formatInTimeZone(new Date(slotStart), timezone, 'h:mm a'),
          endTime: formatInTimeZone(new Date(slotEnd), timezone, 'h:mm a'),
        });
      }

      currentMs += slotIntervalMs;
    }
  }

  private buildBusyIntervals(
    availability: MonthAvailabilityRecord,
    parseTime: (time: string) => number,
  ): BusyInterval[] {
    const intervals: BusyInterval[] = [];

    const travelMs = availability.travelTime * 60 * 1000;

    for (const breakItem of availability.breaks) {
      intervals.push({
        start: parseTime(breakItem.startTime),
        end: parseTime(breakItem.endTime),
      });
    }

    for (const block of availability.instructor.availabilityBlocks) {
      intervals.push({
        start: new Date(block.startDatetime).getTime(),
        end: new Date(block.endDatetime).getTime(),
      });
    }

    for (const booking of availability.instructor.bookings) {
      intervals.push({
        start: new Date(booking.startDatetime).getTime() - travelMs,
        end: new Date(booking.endDatetime).getTime() + travelMs,
      });
    }

    return intervals;
  }

  private groupAvailabilitiesByDay(
    availabilities: MonthAvailabilityRecord[],
  ): Map<number, MonthAvailabilityRecord[]> {
    const grouped = new Map<number, MonthAvailabilityRecord[]>();

    for (const availability of availabilities) {
      const current = grouped.get(availability.dayOfWeek) ?? [];

      current.push(availability);

      grouped.set(availability.dayOfWeek, current);
    }

    return grouped;
  }

  private isAvailabilityValid(availability: MonthAvailabilityRecord): boolean {
    return (
      availability.startTime !== null &&
      availability.endTime !== null &&
      availability.slotInterval > 0 &&
      availability.locations.length > 0
    );
  }

  private getMonthRange(
    month: string,
    timezone: string,
  ): {
    monthPrefix: string;
    daysInMonth: number;
    startOfMonth: string;
    endOfMonth: string;
  } {
    const [yearString, monthString] = month.split('-');

    const year = Number(yearString);
    const monthNumber = Number(monthString);

    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

    const monthPrefix = `${yearString}-${monthString}`;

    const firstDate = `${monthPrefix}-01`;

    const lastDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;

    const startOfMonthZoned = toDate(`${firstDate}T00:00:00`, {
      timeZone: timezone,
    });

    const endOfMonthZoned = toDate(`${lastDate}T23:59:59.999`, {
      timeZone: timezone,
    });

    if (Number.isNaN(startOfMonthZoned.getTime()) || Number.isNaN(endOfMonthZoned.getTime())) {
      throw new BadRequestException(`Invalid month or school timezone: ${timezone}`);
    }

    return {
      monthPrefix,
      daysInMonth,
      startOfMonth: startOfMonthZoned.toISOString(),
      endOfMonth: endOfMonthZoned.toISOString(),
    };
  }

  private validateMonth(month: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }
  }

  private validateDuration(durationMinutes: number): void {
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 60 ||
      durationMinutes > 180 ||
      durationMinutes % 15 !== 0
    ) {
      throw new BadRequestException(
        'Lesson duration must be between 60 and 180 minutes in 15-minute increments',
      );
    }
  }
}
