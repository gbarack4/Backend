import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, ilike, sql, SQL } from 'drizzle-orm';
import * as schema from '../database/schema';
import { SearchSchoolsDto } from './dto/search-schools.dto';
import { SchoolSearchResult } from './interfaces/school-search-result.interface';
import { DEFAULT_SEARCH_RADIUS_METERS } from './constants/school.constants';

@Injectable()
export class SchoolSearchService {
  private readonly logger = new Logger(SchoolSearchService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async searchSchools(query: SearchSchoolsDto): Promise<SchoolSearchResult[]> {
    this.logger.debug(
      `Searching schools with params: ${JSON.stringify(query)}`,
    );
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
          ${schema.locations.coordinates}::geometry,
          ST_MakeEnvelope(${query.minLng}, ${query.minLat}, ${query.maxLng}, ${query.maxLat}, 4326)
        )`,
      );
    }

    if (
      query.originLat !== undefined &&
      query.originLng !== undefined &&
      !hasBboxFilter
    ) {
      const radiusMeters = query.radiusKm
        ? query.radiusKm * 1000
        : DEFAULT_SEARCH_RADIUS_METERS;
      conditions.push(
        sql`ST_DWithin(
          ${schema.locations.coordinates}::geography,
          ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography,
          ${radiusMeters}
        )`,
      );
    }

    const sortingExpression =
      query.originLat !== undefined && query.originLng !== undefined
        ? sql`ST_Distance(
            ${schema.locations.coordinates}::geography,
            ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography
          ) ASC`
        : sql`${schema.schools.name} ASC`;

    try {
      const schoolStats = this.db.$with('school_stats').as(
        this.db
          .select({
            schoolId: schema.instructorSchools.schoolId,
            rating:
              sql<number>`ROUND(AVG(${schema.reviews.rating})::numeric, 1)`.as(
                'rating',
              ),
            reviewCount: sql<number>`COUNT(${schema.reviews.id})::int`.as(
              'reviewCount',
            ),
          })
          .from(schema.reviews)
          .innerJoin(
            schema.instructorSchools,
            eq(
              schema.instructorSchools.instructorId,
              schema.reviews.instructorId,
            ),
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
          address: schema.locations.addressLine1,
          suburb: schema.locations.suburb,
          postcode: schema.locations.postcode,
          longitude: sql<
            number | null
          >`ST_X(${schema.locations.coordinates}::geometry)`,
          latitude: sql<
            number | null
          >`ST_Y(${schema.locations.coordinates}::geometry)`,
          distance:
            query.originLat !== undefined && query.originLng !== undefined
              ? sql<number | null>`CAST(ST_Distance(
                  ${schema.locations.coordinates}::geography,
                  ST_SetSRID(ST_MakePoint(${query.originLng}, ${query.originLat}), 4326)::geography
                ) / 1000 AS FLOAT)`
              : sql<null>`NULL`,
          rating: sql<number>`COALESCE(${schoolStats.rating}, 0)::float`,
          reviewCount: sql<number>`COALESCE(${schoolStats.reviewCount}, 0)::int`,
        })
        .from(schema.schools)
        .leftJoin(
          schema.locations,
          eq(schema.locations.schoolId, schema.schools.id),
        )
        .leftJoin(schoolStats, eq(schema.schools.id, schoolStats.schoolId))
        .where(and(...conditions))
        .orderBy(sortingExpression)
        .limit(query.limit)
        .offset(query.offset);

      return foundSchools.map((school) => ({
        ...school,
        rating: Number(school.rating),
        reviewCount: Number(school.reviewCount),
        distance:
          school.distance !== null
            ? Math.round(Number(school.distance) * 10) / 10
            : null,
      }));
    } catch (error) {
      this.logger.error('Failed to search schools', error);
      throw error;
    }
  }
}
