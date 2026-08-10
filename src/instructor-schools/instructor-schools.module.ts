import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller';
import { InstructorSchoolsService } from './instructor-schools.service';
import { DatabaseModule } from '../database/database.module';
import { InvitesController } from './invites.controller';
import { SuprSendModule } from '@/suprsend/suprsend.module';

@Module({
  imports: [DatabaseModule, SuprSendModule],
  controllers: [JoinRequestsController, InvitesController],
  providers: [InstructorSchoolsService],
  exports: [InstructorSchoolsService],
})
export class InstructorSchoolsModule {}
