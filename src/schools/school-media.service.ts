import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import { S3Service } from '@/storage/s3.service';

type SchoolImageField = 'logoUrl' | 'coverImageUrl';

@Injectable()
export class SchoolMediaService {
  private readonly logger = new Logger(SchoolMediaService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<FullSchema>,
    private readonly s3Service: S3Service,
  ) {}

  async updateSchoolLogo(schoolId: string, newLogoUrl: string) {
    return this.replaceSchoolImage(schoolId, 'logoUrl', newLogoUrl, 'logo');
  }

  async updateSchoolCoverImage(schoolId: string, newCoverImageUrl: string) {
    return this.replaceSchoolImage(schoolId, 'coverImageUrl', newCoverImageUrl, 'cover image');
  }

  private async replaceSchoolImage(
    schoolId: string,
    field: SchoolImageField,
    newUrl: string,
    label: string,
  ) {
    try {
      const [school] = await this.db
        .select({ id: schema.schools.id, currentUrl: schema.schools[field] })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId))
        .limit(1);

      if (!school) {
        throw new NotFoundException('School not found');
      }

      const oldUrl = school.currentUrl;

      await this.db
        .update(schema.schools)
        .set({ [field]: newUrl })
        .where(eq(schema.schools.id, school.id));

      if (oldUrl && oldUrl !== newUrl) {
        try {
          await this.s3Service.deleteFile(oldUrl);
        } catch (err) {
          this.logger.warn(`Failed to delete old ${label} from S3: ${oldUrl}`, err);
        }
      }

      return { success: true, [field]: newUrl };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to update ${label} for school ${schoolId}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw new InternalServerErrorException(`Could not update school ${label}`);
    }
  }
}
