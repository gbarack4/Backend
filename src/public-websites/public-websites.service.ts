import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { WebsiteConfigDto } from './dto/website-config.dto';

@Injectable()
export class PublicWebsitesService {
  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByDomain(domain: string): Promise<WebsiteConfigDto | null> {
    const [record] = await this.db
      .select({
        schoolId: schema.schools.id,
        schoolName: schema.schools.name,
        templateName: schema.websiteTemplates.name,
        baseConfig: schema.websiteTemplates.config,
        customConfig: schema.schoolWebsites.config,
      })
      .from(schema.schoolDomains)
      .innerJoin(
        schema.schools,
        eq(schema.schoolDomains.schoolId, schema.schools.id),
      )
      .innerJoin(
        schema.schoolWebsites,
        eq(schema.schools.id, schema.schoolWebsites.schoolId),
      )
      .innerJoin(
        schema.websiteTemplates,
        eq(schema.schoolWebsites.templateId, schema.websiteTemplates.id),
      )
      .where(
        and(
          eq(schema.schoolDomains.domain, domain),
          eq(schema.schoolDomains.status, 'active'),
          eq(schema.schoolWebsites.status, 'active'),
        ),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    const mergedConfig = {
      ...(record.baseConfig as Record<string, any>),
      ...(record.customConfig as Record<string, any>),
    };

    return {
      schoolId: record.schoolId,
      schoolName: record.schoolName,
      templateName: record.templateName,
      config: mergedConfig,
    };
  }
}
