import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

import * as schema from '../database/schema';
import { UpdateDailyAvailabilityDto } from './dto/update-daily-availability.dto';

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

  async updateDailyAvailability(instructorId: string, dto: UpdateDailyAvailabilityDto) {
    return await this.db.transaction(async (tx) => {
      const [availabilityRecord] = await tx
        .insert(schema.availability)
        .values({
          instructorId,
          dayOfWeek: dto.dayOfWeek,
          isWorking: dto.isWorking,
          startTime: dto.isWorking ? dto.startTime : null,
          endTime: dto.isWorking ? dto.endTime : null,
          slotInterval: dto.slotInterval,
          travelTime: dto.travelTime,
        })
        .onConflictDoUpdate({
          target: [schema.availability.instructorId, schema.availability.dayOfWeek],
          set: {
            isWorking: dto.isWorking,
            startTime: dto.isWorking ? dto.startTime : null,
            endTime: dto.isWorking ? dto.endTime : null,
            slotInterval: dto.slotInterval,
            travelTime: dto.travelTime,
          },
        })
        .returning({ id: schema.availability.id });

      const availabilityId = availabilityRecord.id;

      await tx
        .delete(schema.availabilityLocations)
        .where(eq(schema.availabilityLocations.availabilityId, availabilityId));
      await tx
        .delete(schema.availabilityBreaks)
        .where(eq(schema.availabilityBreaks.availabilityId, availabilityId));

      if (dto.isWorking && dto.locations?.length > 0) {
        await tx
          .insert(schema.availabilityLocations)
          .values(dto.locations.map((suburb) => ({ availabilityId, suburb })));
      }

      if (dto.isWorking && dto.breaks?.length > 0) {
        await tx.insert(schema.availabilityBreaks).values(
          dto.breaks.map((b) => ({
            availabilityId,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        );
      }

      return { success: true, availabilityId };
    });
  }
}
