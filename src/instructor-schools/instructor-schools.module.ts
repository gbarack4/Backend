import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller';
import { InstructorSchoolsService } from './instructor-schools.service';
import { DatabaseModule } from '../database/database.module';
import { InvitesController } from './invites.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [JoinRequestsController, InvitesController],
  providers: [InstructorSchoolsService],
  exports: [InstructorSchoolsService],
})
export class InstructorSchoolsModule {}
