import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { GetInstructorBookingsDto } from './dto/get-instructor-bookings.dto';
import { GetStudentBookingsDto } from './dto/get-student-bookings.dto';
import { normalizeBookingDates } from './utils/normalize-booking-dates';

@Injectable()
export class BookingQueryService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getStudentBookings(userId: string, schoolId: string, dto: GetStudentBookingsDto) {
    const student = await this.db.query.students.findFirst({
      columns: {
        id: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school');
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

    const timezone =
      school.timezone.toLowerCase() === 'sydney' ? 'Australia/Sydney' : school.timezone;

    const now = new Date().toISOString();

    let statusCondition = or(
      and(eq(schema.bookings.status, 'confirmed'), gt(schema.bookings.startDatetime, now)),
      eq(schema.bookings.status, 'completed'),
      eq(schema.bookings.status, 'cancelled'),
    );

    if (dto.status === 'upcoming') {
      statusCondition = and(
        eq(schema.bookings.status, 'confirmed'),
        gt(schema.bookings.startDatetime, now),
      );
    } else if (dto.status === 'completed') {
      statusCondition = eq(schema.bookings.status, 'completed');
    } else if (dto.status === 'cancelled') {
      statusCondition = eq(schema.bookings.status, 'cancelled');
    }

    const normalizedQuery = dto.query?.trim();
    const searchPattern = normalizedQuery ? `%${normalizedQuery}%` : undefined;

    const searchCondition = searchPattern
      ? or(
          ilike(schema.instructors.name, searchPattern),
          ilike(schema.bookings.pickupAddress, searchPattern),
          ilike(schema.bookings.pickupSuburb, searchPattern),
          ilike(schema.bookings.pickupPostcode, searchPattern),
          sql`
            CONCAT_WS(
              ' ',
              TO_CHAR(
                ${schema.bookings.startDatetime} AT TIME ZONE ${timezone},
                'YYYY-MM-DD'
              ),
              TO_CHAR(
                ${schema.bookings.startDatetime} AT TIME ZONE ${timezone},
                'Mon DD YYYY Dy'
              ),
              TO_CHAR(
                ${schema.bookings.startDatetime} AT TIME ZONE ${timezone},
                'FMMonth FMDD YYYY FMDay'
              )
            ) ILIKE ${searchPattern}
          `,
        )
      : undefined;

    const [counts] = await this.db
      .select({
        upcoming: sql<number>`
          COUNT(*) FILTER (
            WHERE ${schema.bookings.status} = 'confirmed'
              AND ${schema.bookings.startDatetime} > ${now}
          )::int
        `,
        completed: sql<number>`
          COUNT(*) FILTER (
            WHERE ${schema.bookings.status} = 'completed'
          )::int
        `,
        cancelled: sql<number>`
          COUNT(*) FILTER (
            WHERE ${schema.bookings.status} = 'cancelled'
          )::int
        `,
      })
      .from(schema.bookings)
      .where(
        and(eq(schema.bookings.schoolId, schoolId), eq(schema.bookings.studentId, student.id)),
      );

    const orderBy =
      dto.status === 'upcoming'
        ? asc(schema.bookings.startDatetime)
        : desc(schema.bookings.startDatetime);

    const bookings = await this.db
      .select({
        id: schema.bookings.id,
        startDatetime: schema.bookings.startDatetime,
        endDatetime: schema.bookings.endDatetime,
        status: schema.bookings.status,
        bookingSource: schema.bookings.bookingSource,

        pickupAddress: schema.bookings.pickupAddress,
        pickupSuburb: schema.bookings.pickupSuburb,
        pickupPostcode: schema.bookings.pickupPostcode,

        cancelledAt: schema.bookings.cancelledAt,
        cancelledByUserId: schema.bookings.cancelledByUserId,

        instructor: {
          id: schema.instructors.id,
          name: schema.instructors.name,
          avatarUrl: schema.instructors.avatarUrl,
          pricePerHour: schema.instructors.pricePerHour,
        },
      })
      .from(schema.bookings)
      .innerJoin(schema.instructors, eq(schema.bookings.instructorId, schema.instructors.id))
      .where(
        and(
          eq(schema.bookings.schoolId, schoolId),
          eq(schema.bookings.studentId, student.id),
          statusCondition,
          searchCondition,
        ),
      )
      .orderBy(orderBy);

    return {
      timezone,
      counts: counts ?? {
        upcoming: 0,
        completed: 0,
        cancelled: 0,
      },
      bookings: bookings.map(normalizeBookingDates),
    };
  }

  async getInstructorBookings(instructorId: string, dto: GetInstructorBookingsDto) {
    const now = new Date().toISOString();

    let statusCondition = or(
      and(eq(schema.bookings.status, 'confirmed'), gt(schema.bookings.startDatetime, now)),
      eq(schema.bookings.status, 'completed'),
      eq(schema.bookings.status, 'cancelled'),
    );

    if (dto.status === 'upcoming') {
      statusCondition = and(
        eq(schema.bookings.status, 'confirmed'),
        gt(schema.bookings.startDatetime, now),
      );
    } else if (dto.status === 'completed') {
      statusCondition = eq(schema.bookings.status, 'completed');
    } else if (dto.status === 'cancelled') {
      statusCondition = eq(schema.bookings.status, 'cancelled');
    }

    const normalizedQuery = dto.query?.trim();
    const searchPattern = normalizedQuery ? `%${normalizedQuery}%` : undefined;

    const schoolTimezone = sql`
    CASE
      WHEN LOWER(${schema.schools.timezone}) = 'sydney'
        THEN 'Australia/Sydney'
      ELSE ${schema.schools.timezone}
    END
  `;

    const searchCondition = searchPattern
      ? or(
          ilike(schema.students.name, searchPattern),
          ilike(schema.students.email, searchPattern),
          ilike(schema.students.phone, searchPattern),
          ilike(schema.schools.name, searchPattern),
          ilike(schema.bookings.pickupAddress, searchPattern),
          ilike(schema.bookings.pickupSuburb, searchPattern),
          ilike(schema.bookings.pickupPostcode, searchPattern),
          sql`
          CONCAT_WS(
            ' ',
            TO_CHAR(
              ${schema.bookings.startDatetime} AT TIME ZONE ${schoolTimezone},
              'YYYY-MM-DD'
            ),
            TO_CHAR(
              ${schema.bookings.startDatetime} AT TIME ZONE ${schoolTimezone},
              'Mon DD YYYY Dy'
            ),
            TO_CHAR(
              ${schema.bookings.startDatetime} AT TIME ZONE ${schoolTimezone},
              'FMMonth FMDD YYYY FMDay'
            )
          ) ILIKE ${searchPattern}
        `,
        )
      : undefined;

    const [counts] = await this.db
      .select({
        upcoming: sql<number>`
        COUNT(*) FILTER (
          WHERE ${schema.bookings.status} = 'confirmed'
            AND ${schema.bookings.startDatetime} > ${now}
        )::int
      `,
        completed: sql<number>`
        COUNT(*) FILTER (
          WHERE ${schema.bookings.status} = 'completed'
        )::int
      `,
        cancelled: sql<number>`
        COUNT(*) FILTER (
          WHERE ${schema.bookings.status} = 'cancelled'
        )::int
      `,
      })
      .from(schema.bookings)
      .where(eq(schema.bookings.instructorId, instructorId));

    const orderBy =
      dto.status === 'upcoming'
        ? asc(schema.bookings.startDatetime)
        : desc(schema.bookings.startDatetime);

    const bookings = await this.db
      .select({
        id: schema.bookings.id,
        startDatetime: schema.bookings.startDatetime,
        endDatetime: schema.bookings.endDatetime,
        status: schema.bookings.status,
        bookingSource: schema.bookings.bookingSource,

        pickupAddress: schema.bookings.pickupAddress,
        pickupSuburb: schema.bookings.pickupSuburb,
        pickupPostcode: schema.bookings.pickupPostcode,

        notes: schema.bookings.notes,

        cancelledAt: schema.bookings.cancelledAt,
        cancelledByUserId: schema.bookings.cancelledByUserId,

        student: {
          id: schema.students.id,
          name: schema.students.name,
          email: schema.students.email,
          phone: schema.students.phone,
        },

        school: {
          id: schema.schools.id,
          name: schema.schools.name,
          logoUrl: schema.schools.logoUrl,
          timezone: schema.schools.timezone,
        },
      })
      .from(schema.bookings)
      .innerJoin(schema.students, eq(schema.bookings.studentId, schema.students.id))
      .innerJoin(schema.schools, eq(schema.bookings.schoolId, schema.schools.id))
      .where(and(eq(schema.bookings.instructorId, instructorId), statusCondition, searchCondition))
      .orderBy(orderBy);

    const normalizedBookings = bookings.map((booking) => ({
      ...normalizeBookingDates(booking),
      school: {
        ...booking.school,
        timezone:
          booking.school.timezone.toLowerCase() === 'sydney'
            ? 'Australia/Sydney'
            : booking.school.timezone,
      },
    }));

    return {
      counts: counts ?? {
        upcoming: 0,
        completed: 0,
        cancelled: 0,
      },
      bookings: normalizedBookings,
    };
  }
}
