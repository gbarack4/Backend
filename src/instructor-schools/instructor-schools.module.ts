import { Module } from '@nestjs/common';
import { InstructorSchoolsService } from './instructor-schools.service';
import { DatabaseModule } from '../database/database.module';
import { SuprSendModule } from '@/suprsend/suprsend.module';
import { InstructorController } from './instructor.controller';
import { SchoolAdminController } from './school-admin.controller';

@Module({
  imports: [DatabaseModule, SuprSendModule],
  controllers: [InstructorController, SchoolAdminController],
  providers: [InstructorSchoolsService],
  exports: [InstructorSchoolsService],
})
export class InstructorSchoolsModule {}
