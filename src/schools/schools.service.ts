import {
  Injectable,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../database/schema';
import slugify from 'slugify';
import { SetupSchoolDto } from './dto/setup-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async setupNewSchool(userId: string, dto: SetupSchoolDto) {
    return await this.db.transaction(async (tx) => {
      try {
        let [defaultTemplate] = await tx
          .select()
          .from(schema.websiteTemplates)
          .where(eq(schema.websiteTemplates.isDefault, true))
          .limit(1);

        if (!defaultTemplate) {
          [defaultTemplate] = await tx
            .insert(schema.websiteTemplates)
            .values({
              name: 'Default Theme',
              isDefault: true,
              config: {},
            })
            .returning();
        }

        const baseSlug = slugify(dto.schoolName, { lower: true, strict: true });
        const uniqueSuffix = Math.random().toString(36).substring(2, 6);
        const slug = `${baseSlug}-${uniqueSuffix}`;

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
          domain: `${slug}.driveinstructor.pro`,
          type: 'subdomain',
          isPrimary: true,
        });

        await tx.insert(schema.locations).values({
          schoolId: school.id,
          name: 'Main Office',
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
      } catch (error) {
        console.error('Setup error:', error);
        throw new InternalServerErrorException('Failed to set up school');
      }
    });
  }
}
