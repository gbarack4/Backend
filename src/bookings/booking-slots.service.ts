import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { and, eq, gt, ilike, inArray, lt, ne, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { BusyInterval, InstructorSlotsMap, InstructorStartSlot } from './types/bookings.types';

@Injectable()
export class BookingSlotsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getAvailableStartSlotsForInstructors(
    schoolId: string,
    instructorIds: string[],
    suburb: string,
    date: string,
  ): Promise<InstructorSlotsMap> {
    if (instructorIds.length === 0) {
      return {};
    }

    const timezone = await this.getSchoolTimezone(schoolId);

    this.validateDate(date);

    const normalizedSuburb = suburb.trim();

    const targetDayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

    const startOfDayZoned = toDate(`${date}T00:00:00`, {
      timeZone: timezone,
    });

    const endOfDayZoned = toDate(`${date}T23:59:59.999`, {
      timeZone: timezone,
    });

    this.validateZonedDates(startOfDayZoned, endOfDayZoned, timezone);

    const startOfSearchDay = startOfDayZoned.toISOString();
    const endOfSearchDay = endOfDayZoned.toISOString();

    const availabilities = await this.db.query.availability.findMany({
      where: and(
        inArray(schema.availability.instructorId, instructorIds),
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

    const slotsByInstructor: InstructorSlotsMap = {};

    for (const instructorId of instructorIds) {
      slotsByInstructor[instructorId] = [];
    }

    const nowMs = Date.now();

    for (const availability of availabilities) {
      if (!availability.startTime || !availability.endTime || availability.locations.length === 0) {
        continue;
      }

      const parseTime = (time: string) =>
        toDate(`${date}T${time}`, {
          timeZone: timezone,
        }).getTime();

      const busyIntervals = this.buildBusyIntervals(availability, parseTime);

      const slotIntervalMs = availability.slotInterval * 60 * 1000;
      const endTimeMs = parseTime(availability.endTime);

      let currentMs = parseTime(availability.startTime);

      while (currentMs + slotIntervalMs <= endTimeMs) {
        const slotStart = currentMs;
        const slotEnd = currentMs + slotIntervalMs;

        const hasOverlap = busyIntervals.some(
          (busy) => slotStart < busy.end && slotEnd > busy.start,
        );

        if (slotStart > nowMs && !hasOverlap) {
          slotsByInstructor[availability.instructorId].push({
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

    return slotsByInstructor;
  }

  async getAvailableStartSlotsForInstructor(
    schoolId: string,
    instructorId: string,
    suburb: string,
    date: string,
  ): Promise<InstructorStartSlot[]> {
    const slotsByInstructor = await this.getAvailableStartSlotsForInstructors(
      schoolId,
      [instructorId],
      suburb,
      date,
    );

    return slotsByInstructor[instructorId] ?? [];
  }

  async getAvailableStartSlotCountsForMonth(
    schoolId: string,
    instructorIds: string[],
    suburb: string,
    date: string,
  ): Promise<Record<string, number>> {
    const emptyCounts = Object.fromEntries(instructorIds.map((instructorId) => [instructorId, 0]));

    if (instructorIds.length === 0) {
      return emptyCounts;
    }

    this.validateDate(date);

    const timezone = await this.getSchoolTimezone(schoolId);
    const normalizedSuburb = suburb.trim();

    const yearString = date.slice(0, 4);
    const monthString = date.slice(5, 7);

    const year = Number(yearString);
    const month = Number(monthString);

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthPrefix = `${yearString}-${monthString}`;

    const firstDate = `${monthPrefix}-01`;
    const lastDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;

    const startOfMonthZoned = toDate(`${firstDate}T00:00:00`, {
      timeZone: timezone,
    });

    const endOfMonthZoned = toDate(`${lastDate}T23:59:59.999`, {
      timeZone: timezone,
    });

    this.validateZonedDates(startOfMonthZoned, endOfMonthZoned, timezone);

    const startOfMonth = startOfMonthZoned.toISOString();
    const endOfMonth = endOfMonthZoned.toISOString();

    const availabilities = await this.db.query.availability.findMany({
      where: and(
        inArray(schema.availability.instructorId, instructorIds),
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
                lt(schema.bookings.startDatetime, endOfMonth),
                gt(schema.bookings.endDatetime, startOfMonth),
                ne(schema.bookings.status, 'cancelled'),
              ),
            },
            availabilityBlocks: {
              where: and(
                lt(schema.availabilityBlocks.startDatetime, endOfMonth),
                gt(schema.availabilityBlocks.endDatetime, startOfMonth),
              ),
            },
          },
        },
      },
    });

    const slotStartsByInstructor = Object.fromEntries(
      instructorIds.map((instructorId) => [instructorId, new Set<number>()]),
    ) as Record<string, Set<number>>;

    const nowMs = Date.now();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const currentDate = `${monthPrefix}-${String(day).padStart(2, '0')}`;

      const dayOfWeek = new Date(`${currentDate}T00:00:00Z`).getUTCDay();

      for (const availability of availabilities) {
        if (!this.isAvailabilityValidForDay(availability, dayOfWeek)) {
          continue;
        }

        this.collectAvailableStartSlots({
          availability,
          currentDate,
          timezone,
          nowMs,
          slotStarts: slotStartsByInstructor[availability.instructorId],
        });
      }
    }

    return Object.fromEntries(
      instructorIds.map((instructorId) => [
        instructorId,
        slotStartsByInstructor[instructorId]?.size ?? 0,
      ]),
    );
  }

  private async getSchoolTimezone(schoolId: string): Promise<string> {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date');
    }
  }

  private validateZonedDates(start: Date, end: Date, timezone: string): void {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(`Invalid date or school timezone: ${timezone}`);
    }
  }

  private buildBusyIntervals(
    availability: {
      travelTime: number;
      breaks: Array<{
        startTime: string;
        endTime: string;
      }>;
      instructor: {
        bookings: Array<{
          startDatetime: string;
          endDatetime: string;
        }>;
        availabilityBlocks: Array<{
          startDatetime: string;
          endDatetime: string;
        }>;
      };
    },
    parseTime: (time: string) => number,
  ): BusyInterval[] {
    const travelMs = availability.travelTime * 60 * 1000;
    const intervals: BusyInterval[] = [];

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

  private isAvailabilityValidForDay(
    availability: {
      dayOfWeek: number;
      startTime: string | null;
      endTime: string | null;
      locations: unknown[];
    },
    dayOfWeek: number,
  ): boolean {
    return (
      availability.dayOfWeek === dayOfWeek &&
      availability.startTime !== null &&
      availability.endTime !== null &&
      availability.locations.length > 0
    );
  }

  private collectAvailableStartSlots({
    availability,
    currentDate,
    timezone,
    nowMs,
    slotStarts,
  }: {
    availability: {
      instructorId: string;
      startTime: string | null;
      endTime: string | null;
      slotInterval: number;
      travelTime: number;
      breaks: Array<{
        startTime: string;
        endTime: string;
      }>;
      instructor: {
        bookings: Array<{
          startDatetime: string;
          endDatetime: string;
        }>;
        availabilityBlocks: Array<{
          startDatetime: string;
          endDatetime: string;
        }>;
      };
    };
    currentDate: string;
    timezone: string;
    nowMs: number;
    slotStarts: Set<number>;
  }): void {
    if (!availability.startTime || !availability.endTime) {
      return;
    }

    const parseTime = (time: string) =>
      toDate(`${currentDate}T${time}`, {
        timeZone: timezone,
      }).getTime();

    const busyIntervals = this.buildBusyIntervals(availability, parseTime);

    const slotIntervalMs = availability.slotInterval * 60 * 1000;

    const endTimeMs = parseTime(availability.endTime);
    let currentMs = parseTime(availability.startTime);

    while (currentMs + slotIntervalMs <= endTimeMs) {
      const slotEnd = currentMs + slotIntervalMs;

      const hasOverlap = busyIntervals.some((busy) => currentMs < busy.end && slotEnd > busy.start);

      if (currentMs > nowMs && !hasOverlap) {
        slotStarts.add(currentMs);
      }

      currentMs += slotIntervalMs;
    }
  }
}
