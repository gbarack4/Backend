import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  HttpException,
  Inject,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import slugify from 'slugify';
import * as schema from '../database/schema';
import { SetupSchoolDto } from './dto/setup-school.dto';

const DEFAULT_LOCATION_NAME = 'Main Office';
const APP_DOMAIN_SUFFIX = 'driveinstructor.pro';
const DEFAULT_TEMPLATE_NAME = 'Default Theme';
const TRIAL_DURATION_DAYS = 14;

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async setupNewSchool(userId: string, dto: SetupSchoolDto) {
    const baseSlug = slugify(dto.schoolName, { lower: true, strict: true });

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
            name: dto.schoolName,
            slug,
            status: 'active',
            subscriptionStatus: 'trialing',
            trialEndsAt: trialEndsAt.toISOString(),
            googleReviewsApiKey: dto.googleReviewsApiKey || null,
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
          address: dto.businessAddress,
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
}
