import { Module } from '@nestjs/common';

import { PublicSchoolPackagesController } from './public-school-packages.controller';
import { SchoolPackagesController } from './school-packages.controller';
import { SchoolPackagesService } from './school-packages.service';

@Module({
  controllers: [SchoolPackagesController, PublicSchoolPackagesController],
  providers: [SchoolPackagesService],
})
export class SchoolPackagesModule {}
