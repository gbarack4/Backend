import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

import { CreateLocationGroupDto } from './dto/create-location-group.dto';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class SchoolPackagesService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getLocationGroups(schoolId: string) {
    return await this.db.query.locationGroups.findMany({
      where: eq(schema.locationGroups.schoolId, schoolId),
      with: {
        suburbs: true,
        packages: {
          columns: { id: true },
        },
      },
    });
  }

  async createLocationGroup(schoolId: string, dto: CreateLocationGroupDto) {
    return await this.db.transaction(async (tx) => {
      const [group] = await tx
        .insert(schema.locationGroups)
        .values({
          schoolId,
          name: dto.name,
        })
        .returning();

      if (dto.suburbs?.length > 0) {
        await tx.insert(schema.locationGroupSuburbs).values(
          dto.suburbs.map((s) => ({
            groupId: group.id,
            suburb: s.suburb,
            postcode: s.postcode,
          })),
        );
      }

      return await tx.query.locationGroups.findFirst({
        where: eq(schema.locationGroups.id, group.id),
        with: { suburbs: true },
      });
    });
  }

  async getPackages(schoolId: string) {
    return await this.db.query.packages.findMany({
      where: eq(schema.packages.schoolId, schoolId),
      with: {
        locationGroup: {
          columns: { name: true },
        },
      },
    });
  }

  async createPackage(schoolId: string, dto: CreatePackageDto) {
    const [newPackage] = await this.db
      .insert(schema.packages)
      .values({
        schoolId,
        locationGroupId: dto.locationGroupId,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        price: dto.price.toString(),
      })
      .returning();

    return newPackage;
  }

  async updateHourlyRate(schoolId: string, hourlyRate: number) {
    const [updatedSchool] = await this.db
      .update(schema.schools)
      .set({ hourlyRate: hourlyRate.toString() })
      .where(eq(schema.schools.id, schoolId))
      .returning({ hourlyRate: schema.schools.hourlyRate });

    if (!updatedSchool) {
      throw new NotFoundException('School not found');
    }

    return updatedSchool;
  }
}
