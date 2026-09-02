import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, exists, gt, isNotNull, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

@Injectable()
export class BookingInstructorsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getSchoolInstructors(userId: string, schoolId: string) {
    const student = await this.db.query.students.findFirst({
      columns: {
        id: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school');
    }

    const workingSchedule = this.db
      .select({
        id: schema.availability.id,
      })
      .from(schema.availability)
      .innerJoin(
        schema.availabilityLocations,
        eq(schema.availabilityLocations.availabilityId, schema.availability.id),
      )
      .where(
        and(
          eq(schema.availability.instructorId, schema.instructors.id),
          eq(schema.availability.isWorking, true),
          isNotNull(schema.availability.startTime),
          isNotNull(schema.availability.endTime),
          lt(schema.availability.startTime, schema.availability.endTime),
          gt(schema.availability.slotInterval, 0),
        ),
      );

    return this.db
      .select({
        id: schema.instructors.id,
        name: schema.instructors.name,
        avatarUrl: schema.instructors.avatarUrl,
        pricePerHour: schema.instructors.pricePerHour,
        suburb: schema.instructors.suburb,
        postcode: schema.instructors.postcode,
        transmissionType: schema.instructors.transmissionType,
      })
      .from(schema.instructors)
      .innerJoin(
        schema.instructorSchools,
        eq(schema.instructorSchools.instructorId, schema.instructors.id),
      )
      .where(
        and(
          eq(schema.instructorSchools.schoolId, schoolId),
          eq(schema.instructorSchools.status, 'accepted'),
          eq(schema.instructors.status, 'active'),
          exists(workingSchedule),
        ),
      )
      .orderBy(asc(schema.instructors.name), asc(schema.instructors.id));
  }
}
