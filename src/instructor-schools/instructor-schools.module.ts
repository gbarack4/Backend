import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller';
import { InstructorSchoolsService } from './instructor-schools.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [JoinRequestsController],
  providers: [InstructorSchoolsService],
  exports: [InstructorSchoolsService],
})
export class InstructorSchoolsModule {}
