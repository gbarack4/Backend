import {
  Injectable,
  Inject,
  Logger,
  ConflictException,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import slugify from 'slugify';
import * as schema from '../database/schema';
import { SetupSchoolDto } from './dto/setup-school.dto';
import {
  DEFAULT_LOCATION_NAME,
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
export class SchoolSetupService {
  private readonly logger = new Logger(SchoolSetupService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
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
}
