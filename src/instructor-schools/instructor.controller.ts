import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';

import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { InstructorSchoolsService } from './instructor-schools.service';

@Controller('instructor')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class InstructorController {
  constructor(private readonly service: InstructorSchoolsService) {}

  @Post('requests')
  async createRequest(@CurrentUser() user: UserEntity, @Body() dto: CreateJoinRequestDto) {
    return this.service.createJoinRequest(user.id, dto.schoolId);
  }

  @Delete('requests/:schoolId')
  async cancelRequest(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.cancelJoinRequest(user.id, schoolId);
  }

  @Get('invites')
  async getMyInvites(@CurrentUser() user: UserEntity) {
    return this.service.findInstructorInvites(user.id);
  }

  @Get('invites/:id')
  async getInviteById(@CurrentUser() user: UserEntity, @Param('id') inviteId: string) {
    return this.service.getSchoolInviteById(user.id, inviteId);
  }

  @Patch('invites/:id/accept')
  async accept(
    @CurrentUser() user: UserEntity,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.respondToInvite(user.id, id, 'accepted');
  }

  @Patch('invites/:id/decline')
  async decline(
    @CurrentUser() user: UserEntity,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.respondToInvite(user.id, id, 'rejected');
  }

  @Patch('schools/:schoolId/pause')
  async pause(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.togglePauseStatus(user.id, schoolId, true);
  }

  @Patch('schools/:schoolId/resume')
  async resume(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.togglePauseStatus(user.id, schoolId, false);
  }

  @Delete('schools/:schoolId/leave')
  async leave(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.deactivateMembership(user.id, schoolId);
  }
}
