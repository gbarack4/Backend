import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { GetStudentBookingsDto } from './dto/get-student-bookings.dto';

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

    const normalizedBookings = bookings.map((booking) => ({
      ...booking,
      startDatetime: new Date(booking.startDatetime).toISOString(),
      endDatetime: new Date(booking.endDatetime).toISOString(),
      cancelledAt: booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : null,
    }));

    return {
      timezone,
      counts: counts ?? {
        upcoming: 0,
        completed: 0,
        cancelled: 0,
      },
      bookings: normalizedBookings,
    };
  }
}
