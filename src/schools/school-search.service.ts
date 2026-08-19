import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, ilike, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

import { SearchSchoolsDto } from './dto/search-schools.dto';
import { SchoolSearchResult } from './interfaces/school-search-result.interface';

@Injectable()
export class SchoolSearchService {
  private readonly logger = new Logger(SchoolSearchService.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase<FullSchema>) {}

  async searchSchools(query: SearchSchoolsDto, userId?: string): Promise<SchoolSearchResult[]> {
    this.logger.debug(`Searching schools with params: ${JSON.stringify(query)}`);

    let actualInstructorId: string | null = null;
    if (userId) {
      const [instructor] = await this.db
        .select({ id: schema.instructors.id })
        .from(schema.instructors)
        .where(eq(schema.instructors.userId, userId))
        .limit(1);

      if (instructor) {
        actualInstructorId = instructor.id;
      }
    }

    const conditions: SQL[] = [];

    conditions.push(eq(schema.schools.status, 'active'));

    if (query.q) {
      const escapedQuery = query.q.replace(/[\\%_]/g, String.raw`\$&`);
      conditions.push(ilike(schema.schools.name, `%${escapedQuery}%`));
    }

    const hasBboxFilter =
      query.minLat !== undefined &&
      query.maxLat !== undefined &&
      query.minLng !== undefined &&
      query.maxLng !== undefined;

    if (hasBboxFilter) {
      conditions.push(
        sql`ST_Within(
          ${schema.locations.publicCoordinates}::geometry,
          ST_MakeEnvelope(${query.minLng}, ${query.minLat}, ${query.maxLng}, ${query.maxLat}, 4326)
        )`,
      );
    }

    if (
      query.originLat !== undefined &&
      query.originLng !== undefined &&
      !hasBboxFilter &&
      query.radiusKm
    ) {
      const radiusMeters = query.radiusKm * 1000;
      conditions.push(
        sql`ST_DWithin(
          ${schema.locations.publicCoordinates}::geography,
          ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography,
          ${radiusMeters}
        )`,
      );
    }

    const sortingExpression =
      query.originLat !== undefined && query.originLng !== undefined
        ? sql`ST_Distance(
            ${schema.locations.publicCoordinates}::geography,
            ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography
          ) ASC`
        : sql`${schema.schools.name} ASC`;

    try {
      const schoolStats = this.db.$with('school_stats').as(
        this.db
          .select({
            schoolId: schema.instructorSchools.schoolId,
            rating: sql<number>`ROUND(AVG(${schema.reviews.rating})::numeric, 1)`.as('rating'),
            reviewCount: sql<number>`COUNT(${schema.reviews.id})::int`.as('reviewCount'),
          })
          .from(schema.reviews)
          .innerJoin(
            schema.instructorSchools,
            eq(schema.instructorSchools.instructorId, schema.reviews.instructorId),
          )
          .groupBy(schema.instructorSchools.schoolId),
      );

      const foundSchools = await this.db
        .with(schoolStats)
        .select({
          id: schema.schools.id,
          locationId: schema.locations.id,
          name: schema.schools.name,
          logoUrl: schema.schools.logoUrl,
          coverImageUrl: schema.schools.coverImageUrl,
          about: schema.schools.description,
          address: schema.locations.publicAddressLine1,

          suburb: schema.locations.suburb,
          postcode: schema.locations.postcode,
          longitude: sql<number | null>`ST_X(${schema.locations.publicCoordinates}::geometry)`,
          latitude: sql<number | null>`ST_Y(${schema.locations.publicCoordinates}::geometry)`,
          distance:
            query.originLat !== undefined && query.originLng !== undefined
              ? sql<number | null>`CAST(ST_Distance(
                  ${schema.locations.publicCoordinates}::geography,
                  ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography
                ) / 1000 AS FLOAT)`
              : sql<null>`NULL`,
          rating: sql<number>`COALESCE(${schoolStats.rating}, 0)::float`,
          reviewCount: sql<number>`COALESCE(${schoolStats.reviewCount}, 0)::int`,
          joinStatus: actualInstructorId
            ? sql<string>`COALESCE(
                (SELECT ${schema.instructorSchools.status} 
                 FROM ${schema.instructorSchools} 
                 WHERE ${schema.instructorSchools.schoolId} = ${schema.schools.id} 
                 AND ${schema.instructorSchools.instructorId} = ${actualInstructorId} 
                 LIMIT 1), 'none')`
            : sql<string>`'none'`,
        })
        .from(schema.schools)
        .leftJoin(schema.locations, eq(schema.locations.schoolId, schema.schools.id))
        .leftJoin(schoolStats, eq(schema.schools.id, schoolStats.schoolId))
        .where(and(...conditions))
        .orderBy(sortingExpression)
        .limit(query.limit)
        .offset(query.offset);

      return foundSchools.map((school) => ({
        ...school,
        rating: Number(school.rating),
        reviewCount: Number(school.reviewCount),
        distance: school.distance !== null ? Math.round(Number(school.distance) * 10) / 10 : null,
      }));
    } catch (error) {
      this.logger.error('Failed to search schools', error);
      throw error;
    }
  }

  async getActiveJoinedSchools(userId: string, q?: string) {
    const conditions: SQL[] = [
      eq(schema.instructors.userId, userId),
      eq(schema.instructorSchools.status, 'accepted'),
    ];

    if (q && q.trim().length > 0) {
      const escapedQuery = q.trim().replace(/[\\%_]/g, String.raw`\$&`);
      conditions.push(ilike(schema.schools.name, `%${escapedQuery}%`));
    }

    const activeSchools = await this.db
      .select({
        id: schema.schools.id,
        name: schema.schools.name,
        logoUrl: schema.schools.logoUrl,
        coverImageUrl: schema.schools.coverImageUrl,
        status: schema.schools.status,
        joinStatus: schema.instructorSchools.status,
        address: schema.locations.addressLine1,
        suburb: schema.locations.suburb,
      })
      .from(schema.instructorSchools)
      .innerJoin(schema.schools, eq(schema.instructorSchools.schoolId, schema.schools.id))
      .innerJoin(
        schema.instructors,
        eq(schema.instructorSchools.instructorId, schema.instructors.id),
      )
      .leftJoin(schema.locations, eq(schema.schools.id, schema.locations.schoolId))
      .where(and(...conditions));

    return activeSchools;
  }
}
