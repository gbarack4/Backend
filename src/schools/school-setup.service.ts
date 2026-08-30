import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import slugify from 'slugify';

import * as schema from '@/database/schema';
import { stripStreetNumber } from '@/common/utils/address.util';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { GeocodingService } from '@/location/geocoding.service';

import {
  DEFAULT_LOCATION_NAME,
  DEFAULT_TEMPLATE_NAME,
  MAX_SLUG_ATTEMPTS,
  TRIAL_DURATION_DAYS,
} from './constants/school.constants';
import { SetupSchoolDto } from './dto/setup-school.dto';

function isPostgresError(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class SchoolSetupService {
  private readonly logger = new Logger(SchoolSetupService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<FullSchema>,
    private readonly geocodingService: GeocodingService,
  ) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true });

    if (!baseSlug) {
      throw new BadRequestException('School name contains invalid characters for URL');
    }

    for (let counter = 1; counter <= MAX_SLUG_ATTEMPTS; counter++) {
      const slug = counter === 1 ? baseSlug : `${baseSlug}-${counter - 1}`;

      const [existing] = await this.db
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(eq(schema.schools.slug, slug))
        .limit(1);

      if (!existing) return slug;
    }

    throw new ConflictException(
      'Could not generate a unique slug. Please try a different school name.',
    );
  }

  async setupNewSchool(userId: string, dto: SetupSchoolDto) {
    const slug = await this.generateUniqueSlug(dto.name);
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

    if (geoResult.status === 'error') {
      this.logger.warn(
        `Geocoding failed for user ${userId}, proceeding without exact coordinates: ${geoResult.message}`,
      );
    } else if (geoResult.status === 'not_found') {
      this.logger.warn(`Exact address not found for user ${userId}: ${fullAddress}`);
    }

    if (publicGeoResult.status === 'error') {
      this.logger.warn(
        `Public geocoding failed for user ${userId}, proceeding without public coordinates: ${publicGeoResult.message}`,
      );
    } else if (publicGeoResult.status === 'not_found') {
      this.logger.warn(`Public address not found for user ${userId}: ${publicAddressForGeo}`);
    }

    try {
      return await this.db.transaction(async (tx) => {
        let [defaultTemplate] = await tx
          .insert(schema.websiteTemplates)
          .values({ name: DEFAULT_TEMPLATE_NAME, isDefault: true, config: {} })
          .onConflictDoNothing({ target: schema.websiteTemplates.name })
          .returning();

        if (!defaultTemplate) {
          [defaultTemplate] = await tx
            .select()
            .from(schema.websiteTemplates)
            .where(eq(schema.websiteTemplates.isDefault, true))
            .limit(1);
        }

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

        const [school] = await tx
          .insert(schema.schools)
          .values({
            ownerUserId: userId,
            name: dto.name,
            slug,
            email: dto.email,
            phone: dto.phone,
            category: dto.category,
            description: dto.description,
            timezone: dto.timezone,
            dateFormat: dto.dateFormat,
            timeFormat: dto.timeFormat,
            status: dto.status,
            subscriptionStatus: 'trialing',
            trialEndsAt: trialEndsAt.toISOString(),
          })
          .returning();

        await tx.insert(schema.schoolDomains).values({
          schoolId: school.id,
          domain: slug,
          type: 'subdomain',
          isPrimary: true,
        });

        await tx.insert(schema.locations).values({
          schoolId: school.id,
          name: DEFAULT_LOCATION_NAME,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          suburb: dto.suburb,
          state: dto.state,
          postcode: dto.postcode,
          coordinates:
            geoResult.status === 'found'
              ? sql`ST_SetSRID(ST_MakePoint(${geoResult.lng}, ${geoResult.lat}), 4326)`
              : null,
          googlePlaceId: null,
          publicAddressLine1: publicAddressLine1,
          publicCoordinates:
            publicGeoResult.status === 'found'
              ? sql`ST_SetSRID(ST_MakePoint(${publicGeoResult.lng}, ${publicGeoResult.lat}), 4326)`
              : null,
        });

        await tx.insert(schema.schoolWebsites).values({
          schoolId: school.id,
          templateId: defaultTemplate.id,
          config: defaultTemplate.config,
        });

        await tx.insert(schema.schoolUsers).values({
          schoolId: school.id,
          userId,
          role: 'owner',
        });

        return { success: true, schoolId: school.id, slug };
      });
    } catch (error: unknown) {
      const errorStack = error instanceof Error ? error.stack : 'Unknown error';
      this.logger.error(`Setup error for user ${userId}:`, errorStack);

      if (error instanceof HttpException) throw error;

      if (isPostgresError(error) && error.code === '23505') {
        switch (error.constraint) {
          case 'schools_slug_key':
            throw new ConflictException('School slug already exists. Please try a different name.');
          case 'school_domains_domain_key':
            throw new ConflictException('This domain is already taken.');
          default:
            throw new ConflictException('A data conflict occurred.');
        }
      }

      throw new InternalServerErrorException('Failed to set up school');
    }
  }
}
