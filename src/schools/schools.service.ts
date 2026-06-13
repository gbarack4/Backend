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
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import slugify from 'slugify';
import * as schema from '../database/schema';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { S3Service } from '../storage/s3.service';

const DEFAULT_LOCATION_NAME = 'Main Office';
const APP_DOMAIN_SUFFIX = 'driveinstructor.pro';
const DEFAULT_TEMPLATE_NAME = 'Default Theme';
const TRIAL_DURATION_DAYS = 14;

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
    private readonly s3Service: S3Service,
  ) {}

  async setupNewSchool(userId: string, dto: SetupSchoolDto) {
    this.logger.log(`DTO: ${JSON.stringify(dto)}`);

    if (!dto.name) {
      throw new BadRequestException('School name is required');
    }

    const baseSlug = slugify(dto.name, { lower: true, strict: true });

    if (!baseSlug) {
      throw new BadRequestException(
        'School name contains invalid characters for URL',
      );
    }

    const uniqueSuffix = randomBytes(4).toString('hex');
    const slug = `${baseSlug}-${uniqueSuffix}`;

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
            status: 'active',
            subscriptionStatus: 'trialing',
            trialEndsAt: trialEndsAt.toISOString(),
            googleBusinessUrl: dto.googleBusinessUrl || null,
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
          address: dto.address,
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

      if (error instanceof HttpException) {
        throw error;
      }

      const isDbError =
        typeof error === 'object' && error !== null && 'code' in error;

      if (isDbError && (error as Record<string, unknown>).code === '23505') {
        const constraint = (error as Record<string, unknown>)
          .constraint as string;

        switch (constraint) {
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

  async getSchoolSettings(userId: string) {
    try {
      const records = await this.db
        .select({
          school: schema.schools,
          user: schema.users,
          location: schema.locations,
          domain: schema.schoolDomains,
        })
        .from(schema.schools)
        .innerJoin(
          schema.users,
          eq(schema.schools.ownerUserId, schema.users.id),
        )
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
        .where(eq(schema.schools.ownerUserId, userId))
        .limit(1);

      if (!records.length) {
        throw new NotFoundException('School settings not found for this user');
      }

      const { school, user, location, domain } = records[0];

      return {
        id: school.id,
        name: school.name,
        email: user.email,
        phone: user.phoneNumber || '',
        address: location?.address || '',
        websiteUrl: domain?.domain || '',
        googleBusinessUrl: school.googleBusinessUrl || '',
        timezone: school.timezone,
        dateFormat: school.dateFormat,
        timeFormat: school.timeFormat,
        logoUrl: school.logoUrl || '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get settings for user ${userId}`, error);
      throw new InternalServerErrorException(
        'Could not retrieve school settings',
      );
    }
  }

  async updateSchoolSettings(userId: string, dto: UpdateSchoolSettingsDto) {
    try {
      const [school] = await this.db
        .select({
          id: schema.schools.id,
          slug: schema.schools.slug,
          logoUrl: schema.schools.logoUrl,
        })
        .from(schema.schools)
        .where(eq(schema.schools.ownerUserId, userId))
        .limit(1);

      if (!school) {
        throw new NotFoundException('School not found for this user');
      }

      let oldLogoUrlToDelete: string | null = null;

      await this.db.transaction(async (tx) => {
        const schoolUpdates: Partial<typeof schema.schools.$inferInsert> = {};

        if (dto.name !== undefined) schoolUpdates.name = dto.name;
        if (dto.googleBusinessUrl !== undefined)
          schoolUpdates.googleBusinessUrl = dto.googleBusinessUrl;
        if (dto.timezone !== undefined) schoolUpdates.timezone = dto.timezone;
        if (dto.dateFormat !== undefined)
          schoolUpdates.dateFormat = dto.dateFormat;
        if (dto.timeFormat !== undefined)
          schoolUpdates.timeFormat = dto.timeFormat;

        if (dto.logoUrl !== undefined) {
          schoolUpdates.logoUrl = dto.logoUrl;
          if (school.logoUrl && school.logoUrl !== dto.logoUrl) {
            oldLogoUrlToDelete = school.logoUrl;
          }
        }

        let newPrefix: string | undefined;
        if (dto.websiteUrl !== undefined && dto.websiteUrl !== school.slug) {
          newPrefix = slugify(dto.websiteUrl, { lower: true, strict: true });
          schoolUpdates.slug = newPrefix;
        }

        if (Object.keys(schoolUpdates).length > 0) {
          await tx
            .update(schema.schools)
            .set(schoolUpdates)
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

        if (dto.address !== undefined) {
          await tx
            .update(schema.locations)
            .set({ address: dto.address })
            .where(eq(schema.locations.schoolId, school.id));
        }

        if (dto.phone !== undefined) {
          await tx
            .update(schema.users)
            .set({ phoneNumber: dto.phone })
            .where(eq(schema.users.id, userId));
        }
      });

      if (oldLogoUrlToDelete) {
        await this.s3Service.deleteFile(oldLogoUrlToDelete);
      }

      return { success: true, message: 'Settings updated successfully' };
    } catch (error: unknown) {
      const isDbError =
        typeof error === 'object' && error !== null && 'code' in error;
      if (isDbError && (error as Record<string, unknown>).code === '23505') {
        const constraint = (error as Record<string, unknown>)
          .constraint as string;
        if (
          constraint === 'schools_slug_key' ||
          constraint === 'school_domains_domain_key'
        ) {
          throw new ConflictException(
            'This domain prefix is already taken. Please choose another one.',
          );
        }
      }

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to update settings for user ${userId}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw new InternalServerErrorException(
        'Could not update school settings',
      );
    }
  }
}
