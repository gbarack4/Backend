import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ilike, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

import { CreateLocationGroupDto } from './dto/create-location-group.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdateLocationGroupDto } from './dto/update-location-group.dto';

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

  async updateLocationGroup(schoolId: string, groupId: string, dto: UpdateLocationGroupDto) {
    return await this.db.transaction(async (tx) => {
      const group = await tx.query.locationGroups.findFirst({
        where: and(
          eq(schema.locationGroups.id, groupId),
          eq(schema.locationGroups.schoolId, schoolId),
        ),
      });

      if (!group) throw new NotFoundException('Location group not found');

      if (dto.name) {
        await tx
          .update(schema.locationGroups)
          .set({ name: dto.name })
          .where(eq(schema.locationGroups.id, groupId));
      }

      if (dto.suburbs) {
        await tx
          .delete(schema.locationGroupSuburbs)
          .where(eq(schema.locationGroupSuburbs.groupId, groupId));

        if (dto.suburbs.length > 0) {
          await tx.insert(schema.locationGroupSuburbs).values(
            dto.suburbs.map((s) => ({
              groupId,
              suburb: s.suburb,
              postcode: s.postcode || null,
            })),
          );
        }
      }

      return await tx.query.locationGroups.findFirst({
        where: eq(schema.locationGroups.id, groupId),
        with: { suburbs: true },
      });
    });
  }

  async deleteLocationGroup(schoolId: string, groupId: string) {
    return await this.db.transaction(async (tx) => {
      const group = await tx.query.locationGroups.findFirst({
        where: and(
          eq(schema.locationGroups.id, groupId),
          eq(schema.locationGroups.schoolId, schoolId),
        ),
      });

      if (!group) throw new NotFoundException('Location group not found');

      await tx
        .delete(schema.locationGroupSuburbs)
        .where(eq(schema.locationGroupSuburbs.groupId, groupId));

      await tx.delete(schema.locationGroups).where(eq(schema.locationGroups.id, groupId));

      return { success: true, deletedId: groupId };
    });
  }

  async getHourlyRate(schoolId: string) {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, schoolId),
      columns: { hourlyRate: true },
    });
    return { hourlyRate: school?.hourlyRate || null };
  }

  async updatePackage(schoolId: string, id: string, dto: Partial<CreatePackageDto>) {
    const [updated] = await this.db
      .update(schema.packages)
      .set({
        ...(dto.name && { name: dto.name }),
        ...(dto.durationMinutes && { durationMinutes: dto.durationMinutes }),
        ...(dto.price && { price: dto.price.toString() }),
        ...(dto.locationGroupId && { locationGroupId: dto.locationGroupId }),
      })
      .where(and(eq(schema.packages.id, id), eq(schema.packages.schoolId, schoolId)))
      .returning();
    return updated;
  }

  async updatePackageStatus(schoolId: string, id: string, status: 'active' | 'archived') {
    const [updated] = await this.db
      .update(schema.packages)
      .set({ status })
      .where(and(eq(schema.packages.id, id), eq(schema.packages.schoolId, schoolId)))
      .returning();
    return updated;
  }

  async deletePackage(schoolId: string, id: string) {
    await this.db
      .delete(schema.packages)
      .where(and(eq(schema.packages.id, id), eq(schema.packages.schoolId, schoolId)));
    return { success: true };
  }

  async getPublicPackagesBySuburb(schoolId: string, suburb: string) {
    const normalizedSuburb = suburb.trim();

    return this.db
      .selectDistinct({
        id: schema.packages.id,
        name: schema.packages.name,
        durationMinutes: schema.packages.durationMinutes,
        price: schema.packages.price,
      })
      .from(schema.packages)
      .innerJoin(
        schema.locationGroupSuburbs,
        eq(schema.packages.locationGroupId, schema.locationGroupSuburbs.groupId),
      )
      .where(
        and(
          eq(schema.packages.schoolId, schoolId),
          eq(schema.packages.status, 'active'),
          or(
            ilike(schema.locationGroupSuburbs.suburb, `%${normalizedSuburb}%`),
            ilike(schema.locationGroupSuburbs.postcode, `%${normalizedSuburb}%`),
          ),
        ),
      );
  }

  async getLowestPublicPriceBySuburb(schoolId: string, suburb: string): Promise<number | null> {
    const packages = await this.getPublicPackagesBySuburb(schoolId, suburb);

    const prices = packages
      .map((pkg) => Number(pkg.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length === 0) {
      return null;
    }

    return Math.min(...prices);
  }
}
