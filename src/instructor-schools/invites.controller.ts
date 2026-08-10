import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { InstructorSchoolsService } from './instructor-schools.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { isUUID } from 'class-validator';

@Controller('invites')
@UseGuards(ClerkAuthGuard)
export class InvitesController {
  constructor(
    private readonly instructorSchoolsService: InstructorSchoolsService,
  ) {}

  @Post()
  async createInvite(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: CreateInviteDto,
  ) {
    if (!schoolId || !isUUID(schoolId, 4)) {
      throw new BadRequestException('Invalid or missing x-school-id header');
    }

    return this.instructorSchoolsService.createSchoolInvite(
      schoolId,
      dto.instructorId,
    );
  }

  @Get('my')
  async getMyInvites(@CurrentUser() user: UserEntity) {
    return this.instructorSchoolsService.findInstructorInvites(user.id);
  }

  @Patch(':id/accept')
  async acceptInvite(
    @CurrentUser() user: UserEntity,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.instructorSchoolsService.respondToInvite(
      user.id,
      id,
      'accepted',
    );
  }

  @Patch(':id/decline')
  async declineInvite(
    @CurrentUser() user: UserEntity,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.instructorSchoolsService.respondToInvite(
      user.id,
      id,
      'rejected',
    );
  }
}
