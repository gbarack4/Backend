import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/database/database.module';
import { LocationModule } from '@/location/geocoding.module';
import { UsersModule } from '@/users/users.module';

import { SchoolMediaService } from './school-media.service';
import { SchoolSearchService } from './school-search.service';
import { SchoolSettingsService } from './school-settings.service';
import { SchoolSetupService } from './school-setup.service';
import { SchoolsUploadController } from './schools-upload.controller';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

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
