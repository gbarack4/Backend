import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import slugify from 'slugify';

import { stripStreetNumber } from '@/common/utils/address.util';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';
import { GeocodingService } from '@/location/geocoding.service';
import { GeocodeResult } from '@/location/types/geocoding.types';

import * as schema from '../database/schema';
import { APP_DOMAIN_SUFFIX } from './constants/school.constants';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';

function isPostgresError(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class SchoolSettingsService {
  private readonly logger = new Logger(SchoolSettingsService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<FullSchema>,
    private readonly geocodingService: GeocodingService,
  ) {}

  async getSchoolSettings(schoolId: string) {
    try {
      const records = await this.db
        .select({
          school: schema.schools,
          location: schema.locations,
          domain: schema.schoolDomains,
        })
        .from(schema.schools)
        .leftJoin(schema.locations, eq(schema.locations.schoolId, schema.schools.id))
        .leftJoin(
          schema.schoolDomains,
          and(
            eq(schema.schoolDomains.schoolId, schema.schools.id),
            eq(schema.schoolDomains.isPrimary, true),
          ),
        )
        .where(eq(schema.schools.id, schoolId))
        .orderBy(desc(schema.schools.createdAt))
        .limit(1);

      if (!records.length) {
        throw new NotFoundException('School settings not found');
      }

      const { school, location, domain } = records[0];

      const domainPrefix = domain?.domain ? domain.domain.replace(`.${APP_DOMAIN_SUFFIX}`, '') : '';

      return {
        id: school.id,
        name: school.name,
        email: school.email || '',
        phone: school.phone || '',
        status: school.status || '',
        category: school.category || '',
        description: school.description || '',
        addressLine1: location?.addressLine1 || '',
        addressLine2: location?.addressLine2 || '',
        suburb: location?.suburb || '',
        state: location?.state || '',
        postcode: location?.postcode || '',
        domainPrefix,
        timezone: school.timezone,
        dateFormat: school.dateFormat,
        timeFormat: school.timeFormat,
        logoUrl: school.logoUrl || '',
        coverImageUrl: school.coverImageUrl || '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to get settings for school ${schoolId}`, error);
      throw new InternalServerErrorException('Could not retrieve school settings');
    }
  }

  async updateSchoolSettings(schoolId: string, dto: UpdateSchoolSettingsDto) {
    try {
      const records = await this.db
        .select({
          school: schema.schools,
          location: schema.locations,
        })
        .from(schema.schools)
        .leftJoin(schema.locations, eq(schema.locations.schoolId, schema.schools.id))
        .where(eq(schema.schools.id, schoolId))
        .limit(1);

      if (!records.length) {
        throw new NotFoundException('School not found');
      }

      const { school, location } = records[0];

      const { geoResult, publicGeoResult, publicAddressLine1, hasAddressUpdate } =
        await this.resolveGeocodeResult(schoolId, dto, location);

      await this.db.transaction(async (tx) => {
        await this.applySchoolUpdates(tx, school, dto);
        await this.applyLocationUpdates(
          tx,
          school.id,
          dto,
          geoResult,
          publicGeoResult,
          publicAddressLine1,
          hasAddressUpdate,
        );
      });

      return { success: true, message: 'Settings updated successfully' };
    } catch (error: unknown) {
      throw this.mapUpdateError(schoolId, error);
    }
  }

  private async resolveGeocodeResult(
    schoolId: string,
    dto: UpdateSchoolSettingsDto,
    currentLocation: typeof schema.locations.$inferSelect | null,
  ): Promise<{
    geoResult: GeocodeResult | null;
    publicGeoResult: GeocodeResult | null;
    publicAddressLine1: string | null;
    hasAddressUpdate: boolean;
  }> {
    const hasAddressUpdate =
      dto.addressLine1 !== currentLocation?.addressLine1 ||
      (dto.addressLine2 || null) !== (currentLocation?.addressLine2 || null) ||
      dto.suburb !== currentLocation?.suburb ||
      dto.state !== currentLocation?.state ||
      dto.postcode !== currentLocation?.postcode;

    if (!hasAddressUpdate) {
      return {
        geoResult: null,
        publicGeoResult: null,
        publicAddressLine1: null,
        hasAddressUpdate: false,
      };
    }

    const publicAddressLine1 = stripStreetNumber(dto.addressLine1);

    const fullAddress = [
      dto.addressLine1,
      dto.addressLine2,
      dto.suburb,
      dto.state,
      dto.postcode,
      'Australia',
    ]
      .filter(Boolean)
      .join(', ');

    const publicAddressForGeo = [
      publicAddressLine1,
      dto.suburb,
      dto.state,
      dto.postcode,
      'Australia',
    ]
      .filter(Boolean)
      .join(', ');

    const [geoResult, publicGeoResult] = await Promise.all([
      this.geocodingService.getCoordinatesFromAddress(fullAddress, 'au'),
      this.geocodingService.getCoordinatesFromAddress(publicAddressForGeo, 'au'),
    ]);

    this.logGeocodeOutcome(schoolId, fullAddress, geoResult, 'exact');
    this.logGeocodeOutcome(schoolId, publicAddressForGeo, publicGeoResult, 'public');

    return {
      geoResult,
      publicGeoResult,
      publicAddressLine1,
      hasAddressUpdate: true,
    };
  }

  private logGeocodeOutcome(
    schoolId: string,
    addressString: string,
    geoResult: GeocodeResult,
    type: 'exact' | 'public',
  ): void {
    if (geoResult.status === 'error') {
      this.logger.warn(
        `${type.toUpperCase()} geocoding failed for school ${schoolId} update: ${geoResult.message}`,
      );
      return;
    }

    if (geoResult.status === 'not_found') {
      this.logger.warn(
        `${type.toUpperCase()} address not found for school ${schoolId} update: ${addressString}`,
      );
    }
  }

  private mapUpdateError(schoolId: string, error: unknown): HttpException {
    if (isPostgresError(error) && error.code === '23505') {
      const conflictConstraints = ['schools_slug_key', 'school_domains_domain_key'];
      if (error.constraint && conflictConstraints.includes(error.constraint)) {
        return new ConflictException(
          'This domain prefix is already taken. Please choose another one.',
        );
      }
    }

    if (error instanceof HttpException) return error;

    this.logger.error(
      `Failed to update settings for school ${schoolId}`,
      error instanceof Error ? error.stack : 'Unknown error',
    );
    return new InternalServerErrorException('Could not update school settings');
  }

  private buildSchoolUpdates(
    dto: UpdateSchoolSettingsDto,
    currentSlug: string,
  ): {
    updates: Partial<typeof schema.schools.$inferInsert>;
    newPrefix: string | undefined;
  } {
    const updates: Partial<typeof schema.schools.$inferInsert> = {};

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.timezone !== undefined) updates.timezone = dto.timezone;
    if (dto.dateFormat !== undefined) updates.dateFormat = dto.dateFormat;
    if (dto.timeFormat !== undefined) updates.timeFormat = dto.timeFormat;
    let newPrefix: string | undefined;
    if (dto.domainPrefix !== undefined && dto.domainPrefix !== currentSlug) {
      newPrefix = slugify(dto.domainPrefix, { lower: true, strict: true });
      updates.slug = newPrefix;
    }

    return { updates, newPrefix };
  }

  private buildLocationUpdates(
    dto: UpdateSchoolSettingsDto,
    geoResult: GeocodeResult | null,
    publicGeoResult: GeocodeResult | null,
    publicAddressLine1: string | null,
    hasAddressUpdate: boolean,
  ) {
    const updates: Record<string, string | SQL | null> = {};

    if (dto.addressLine1 !== undefined) {
      updates.addressLine1 = dto.addressLine1;

      if (hasAddressUpdate) {
        updates.publicAddressLine1 = publicAddressLine1;
      }
    }
    if (dto.addressLine2 !== undefined) updates.addressLine2 = dto.addressLine2;
    if (dto.suburb !== undefined) updates.suburb = dto.suburb;
    if (dto.state !== undefined) updates.state = dto.state;
    if (dto.postcode !== undefined) updates.postcode = dto.postcode;

    if (hasAddressUpdate) {
      if (geoResult?.status === 'found') {
        updates.coordinates = sql`ST_SetSRID(ST_MakePoint(${geoResult.lng}, ${geoResult.lat}), 4326)`;
      } else if (geoResult?.status === 'not_found') {
        updates.coordinates = null;
      }

      if (publicGeoResult?.status === 'found') {
        updates.publicCoordinates = sql`ST_SetSRID(ST_MakePoint(${publicGeoResult.lng}, ${publicGeoResult.lat}), 4326)`;
      } else if (publicGeoResult?.status === 'not_found') {
        updates.publicCoordinates = null;
      }
    }

    return updates;
  }

  private async applySchoolUpdates(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    school: { id: string; slug: string; logoUrl: string | null },
    dto: UpdateSchoolSettingsDto,
  ): Promise<void> {
    const { updates, newPrefix } = this.buildSchoolUpdates(dto, school.slug);

    if (Object.keys(updates).length > 0) {
      await tx.update(schema.schools).set(updates).where(eq(schema.schools.id, school.id));
    }

    if (newPrefix) {
      await tx
        .update(schema.schoolDomains)
        .set({ domain: newPrefix })
        .where(
          and(
            eq(schema.schoolDomains.schoolId, school.id),
            eq(schema.schoolDomains.isPrimary, true),
          ),
        );
    }
  }

  private async applyLocationUpdates(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    schoolId: string,
    dto: UpdateSchoolSettingsDto,
    geoResult: GeocodeResult | null,
    publicGeoResult: GeocodeResult | null,
    publicAddressLine1: string | null,
    hasAddressUpdate: boolean,
  ): Promise<void> {
    const updates = this.buildLocationUpdates(
      dto,
      geoResult,
      publicGeoResult,
      publicAddressLine1,
      hasAddressUpdate,
    );

    if (Object.keys(updates).length > 0) {
      await tx.update(schema.locations).set(updates).where(eq(schema.locations.schoolId, schoolId));
    }
  }
}
