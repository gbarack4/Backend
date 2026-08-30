import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import type { RequestWithAuth, UserEntity } from '@/auth/interfaces/auth.interface';

import { SyncStudentDto } from './dto/sync-student.dto';
import { UpdateStudentAvatarDto } from './dto/update-student-avatar.dto';
import { UpdateStudentPersonalInfoDto } from './dto/update-student-personal-info.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @UseGuards(ClerkAuthGuard)
  @Post('sync')
  async syncStudent(@Req() request: RequestWithAuth, @Body() dto: SyncStudentDto) {
    const clerkUserId = request.authPayload?.clerkId;

    if (!clerkUserId) {
      throw new UnauthorizedException('Authentication payload is missing');
    }

    return this.studentsService.syncStudentWithSchool(clerkUserId, dto.schoolId);
  }

  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @Get('school/:schoolId/me')
  @ApiOperation({
    summary: 'Get current student profile for a specific school',
  })
  @ApiResponse({
    status: 200,
    description: 'Student profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Student or user not found' })
  async getMyStudentProfile(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.studentsService.getStudentByUserIdAndSchool(user.id, schoolId);
  }

  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @Patch('school/:schoolId/me/avatar')
  @ApiOperation({
    summary: 'Update current student avatar for a specific school',
  })
  @ApiResponse({
    status: 200,
    description: 'Student avatar updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Student record not found' })
  async updateMyAvatar(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Body() dto: UpdateStudentAvatarDto,
  ) {
    return this.studentsService.updateAvatarUrl(user.id, schoolId, dto.avatarUrl);
  }

  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @Patch('school/:schoolId/me/personal-info')
  @ApiOperation({
    summary: 'Update current student personal information for a specific school',
  })
  @ApiResponse({
    status: 200,
    description: 'Student personal information updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Student record not found' })
  async updateMyPersonalInfo(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Body() dto: UpdateStudentPersonalInfoDto,
  ) {
    return this.studentsService.updatePersonalInfo(user.id, schoolId, dto);
  }
}
