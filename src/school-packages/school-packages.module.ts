import { Module } from '@nestjs/common';

import { SchoolPackagesController } from './school-packages.controller';
import { SchoolPackagesService } from './school-packages.service';

@Module({
  controllers: [SchoolPackagesController],
  providers: [SchoolPackagesService],
})
export class SchoolPackagesModule {}
