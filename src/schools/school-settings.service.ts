import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  HttpException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import slugify from 'slugify';
import * as schema from '../database/schema';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { APP_DOMAIN_SUFFIX } from './constants/school.constants';

function isPostgresError(
  error: unknown,
): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class SchoolSettingsService {
  private readonly logger = new Logger(SchoolSettingsService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
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
        .leftJoin(
          schema.locations,
          eq(schema.locations.schoolId, schema.schools.id),
        )
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

      const domainPrefix = domain?.domain
        ? domain.domain.replace(`.${APP_DOMAIN_SUFFIX}`, '')
        : '';

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
      throw new InternalServerErrorException(
        'Could not retrieve school settings',
      );
    }
  }

  async updateSchoolSettings(schoolId: string, dto: UpdateSchoolSettingsDto) {
    try {
      const [school] = await this.db
        .select({
          id: schema.schools.id,
          slug: schema.schools.slug,
          logoUrl: schema.schools.logoUrl,
        })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId))
        .limit(1);

      if (!school) {
        throw new NotFoundException('School not found');
      }

      await this.db.transaction(async (tx) => {
        await this.applySchoolUpdates(tx, school, dto);
        await this.applyLocationUpdates(tx, school.id, dto);
      });

      return { success: true, message: 'Settings updated successfully' };
    } catch (error: unknown) {
      if (isPostgresError(error) && error.code === '23505') {
        if (
          error.constraint === 'schools_slug_key' ||
          error.constraint === 'school_domains_domain_key'
        ) {
          throw new ConflictException(
            'This domain prefix is already taken. Please choose another one.',
          );
        }
      }

      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to update settings for school ${schoolId}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw new InternalServerErrorException(
        'Could not update school settings',
      );
    }
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
  ): Partial<typeof schema.locations.$inferInsert> {
    const updates: Partial<typeof schema.locations.$inferInsert> = {};

    if (dto.addressLine1 !== undefined) updates.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) updates.addressLine2 = dto.addressLine2;
    if (dto.suburb !== undefined) updates.suburb = dto.suburb;
    if (dto.state !== undefined) updates.state = dto.state;
    if (dto.postcode !== undefined) updates.postcode = dto.postcode;

    return updates;
  }

  private async applySchoolUpdates(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    school: { id: string; slug: string; logoUrl: string | null },
    dto: UpdateSchoolSettingsDto,
  ): Promise<void> {
    const { updates, newPrefix } = this.buildSchoolUpdates(dto, school.slug);

    if (Object.keys(updates).length > 0) {
      await tx
        .update(schema.schools)
        .set(updates)
        .where(eq(schema.schools.id, school.id));
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
  ): Promise<void> {
    const updates = this.buildLocationUpdates(dto);

    if (Object.keys(updates).length > 0) {
      await tx
        .update(schema.locations)
        .set(updates)
        .where(eq(schema.locations.schoolId, schoolId));
    }
  }
}
