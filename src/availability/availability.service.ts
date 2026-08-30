import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { UpdateBulkAvailabilityDto } from './dto/update-bulk-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getInstructorAvailability(instructorId: string) {
    return await this.db.query.availability.findMany({
      where: eq(schema.availability.instructorId, instructorId),
      with: {
        locations: true,
        breaks: true,
      },
    });
  }

  async updateBulkAvailability(instructorId: string, dto: UpdateBulkAvailabilityDto) {
    return await this.db.transaction(async (tx) => {
      const updatedIds: string[] = [];

      for (const day of dto.days) {
        const [availabilityRecord] = await tx
          .insert(schema.availability)
          .values({
            instructorId,
            dayOfWeek: day.dayOfWeek,
            isWorking: day.isWorking,
            startTime: day.isWorking ? day.startTime : null,
            endTime: day.isWorking ? day.endTime : null,
            slotInterval: day.slotInterval,
            travelTime: day.travelTime,
          })
          .onConflictDoUpdate({
            target: [schema.availability.instructorId, schema.availability.dayOfWeek],
            set: {
              isWorking: day.isWorking,
              startTime: day.isWorking ? day.startTime : null,
              endTime: day.isWorking ? day.endTime : null,
              slotInterval: day.slotInterval,
              travelTime: day.travelTime,
            },
          })
          .returning({ id: schema.availability.id });

        const availabilityId = availabilityRecord.id;
        updatedIds.push(availabilityId);

        await tx
          .delete(schema.availabilityLocations)
          .where(eq(schema.availabilityLocations.availabilityId, availabilityId));
        await tx
          .delete(schema.availabilityBreaks)
          .where(eq(schema.availabilityBreaks.availabilityId, availabilityId));

        if (day.isWorking && day.locations?.length > 0) {
          await tx
            .insert(schema.availabilityLocations)
            .values(day.locations.map((suburb) => ({ availabilityId, suburb })));
        }

        if (day.isWorking && day.breaks?.length > 0) {
          await tx.insert(schema.availabilityBreaks).values(
            day.breaks.map((b) => ({
              availabilityId,
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          );
        }
      }

      return { success: true, updatedIds };
    });
  }
}
