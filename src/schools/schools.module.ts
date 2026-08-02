import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsUploadController } from './schools-upload.controller';
import { SchoolsService } from './schools.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { SchoolSearchService } from './school-search.service';
import { SchoolSetupService } from './school-setup.service';
import { SchoolSettingsService } from './school-settings.service';
import { SchoolMediaService } from './school-media.service';
import { LocationModule } from '@/location/geocoding.module';

@Module({
  imports: [DatabaseModule, UsersModule, LocationModule],
  controllers: [SchoolsController, SchoolsUploadController],
  providers: [
    SchoolsService,
    SchoolSearchService,
    SchoolSetupService,
    SchoolSettingsService,
    SchoolMediaService,
  ],
  exports: [SchoolsService],
})
export class SchoolsModule {}
