import { Module } from '@nestjs/common';

import { SuprSendModule } from '@/suprsend/suprsend.module';

import { DatabaseModule } from '../database/database.module';
import { InstructorSchoolsService } from './instructor-schools.service';
import { InstructorController } from './instructor.controller';
import { SchoolAdminController } from './school-admin.controller';

@Module({
  imports: [DatabaseModule, SuprSendModule],
  controllers: [InstructorController, SchoolAdminController],
  providers: [InstructorSchoolsService],
  exports: [InstructorSchoolsService],
})
export class InstructorSchoolsModule {}
