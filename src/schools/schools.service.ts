import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  HttpException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import slugify from 'slugify';
import * as schema from '../database/schema';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { S3Service } from '../storage/s3.service';
import {
  DEFAULT_LOCATION_NAME,
  APP_DOMAIN_SUFFIX,
  DEFAULT_TEMPLATE_NAME,
  TRIAL_DURATION_DAYS,
  MAX_SLUG_ATTEMPTS,
} from './constants/school.constants';

function isPostgresError(
  error: unknown,
): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
    private readonly s3Service: S3Service,
  ) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true });

    if (!baseSlug) {
      throw new BadRequestException(
        'School name contains invalid characters for URL',
      );
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
    this.logger.log(`Setting up school for user ${userId}`);

    const slug = await this.generateUniqueSlug(dto.name);

    try {
      return await this.db.transaction(async (tx) => {
        let [defaultTemplate] = await tx
          .insert(schema.websiteTemplates)
          .values({
            name: DEFAULT_TEMPLATE_NAME,
            isDefault: true,
            config: {},
          })
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
          domain: `${slug}.${APP_DOMAIN_SUFFIX}`,
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
            throw new ConflictException(
              'School slug already exists. Please try a different name.',
            );
          case 'school_domains_domain_key':
            throw new ConflictException('This domain is already taken.');
          default:
            throw new ConflictException('A data conflict occurred.');
        }
      }

      throw new InternalServerErrorException('Failed to set up school');
    }
  }

  async getDefaultSchool(userId: string) {
    try {
      const [record] = await this.db
        .select({
          id: schema.schools.id,
          name: schema.schools.name,
          slug: schema.schools.slug,
        })
        .from(schema.schoolUsers)
        .innerJoin(
          schema.schools,
          eq(schema.schools.id, schema.schoolUsers.schoolId),
        )
        .where(eq(schema.schoolUsers.userId, userId))
        .orderBy(schema.schoolUsers.createdAt)
        .limit(1);

      if (!record) {
        return null;
      }

      return record;
    } catch (error) {
      this.logger.error(
        `Failed to get default school for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not retrieve default school',
      );
    }
  }

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

  // -------------------------------------------------------------------------
  // Transaction helpers
  // -------------------------------------------------------------------------

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
        .set({ domain: `${newPrefix}.${APP_DOMAIN_SUFFIX}` })
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

  async updateSchoolLogo(schoolId: string, newLogoUrl: string) {
    try {
      const [school] = await this.db
        .select({ id: schema.schools.id, logoUrl: schema.schools.logoUrl })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId))
        .limit(1);

      if (!school) {
        throw new NotFoundException('School not found');
      }

      const oldLogoUrl = school.logoUrl;

      await this.db
        .update(schema.schools)
        .set({ logoUrl: newLogoUrl })
        .where(eq(schema.schools.id, school.id));

      if (oldLogoUrl && oldLogoUrl !== newLogoUrl) {
        try {
          await this.s3Service.deleteFile(oldLogoUrl);
        } catch (err) {
          this.logger.warn(
            `Failed to delete old logo from S3: ${oldLogoUrl}`,
            err,
          );
        }
      }

      return { success: true, logoUrl: newLogoUrl };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to update logo for school ${schoolId}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw new InternalServerErrorException('Could not update school logo');
    }
  }

  async updateSchoolCoverImage(schoolId: string, newCoverImageUrl: string) {
    try {
      const [school] = await this.db
        .select({
          id: schema.schools.id,
          coverImageUrl: schema.schools.coverImageUrl,
        })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId))
        .limit(1);

      if (!school) {
        throw new NotFoundException('School not found');
      }

      const oldCoverImageUrl = school.coverImageUrl;

      await this.db
        .update(schema.schools)
        .set({ coverImageUrl: newCoverImageUrl })
        .where(eq(schema.schools.id, school.id));

      if (oldCoverImageUrl && oldCoverImageUrl !== newCoverImageUrl) {
        try {
          await this.s3Service.deleteFile(oldCoverImageUrl);
        } catch (err) {
          this.logger.warn(
            `Failed to delete old cover image from S3: ${oldCoverImageUrl}`,
            err,
          );
        }
      }

      return { success: true, coverImageUrl: newCoverImageUrl };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to update cover image for school ${schoolId}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw new InternalServerErrorException(
        'Could not update school cover image',
      );
    }
  }
}
