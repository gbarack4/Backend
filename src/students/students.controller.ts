import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { SyncStudentDto } from './dto/sync-student.dto';
import { UpdateStudentAvatarDto } from './dto/update-student-avatar.dto';
import { UpdateStudentPersonalInfoDto } from './dto/update-student-personal-info.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @Post('sync')
  async syncStudent(
    @CurrentUser() user: UserEntity,
    @Body() dto: SyncStudentDto,
  ) {
    return this.studentsService.syncStudentWithSchool(
      user.clerkId,
      dto.schoolId,
    );
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
    @Param('schoolId') schoolId: string,
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
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateStudentAvatarDto,
  ) {
    return this.studentsService.updateAvatarUrl(
      user.id,
      schoolId,
      dto.avatarUrl,
    );
  }

  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @Patch('school/:schoolId/me/personal-info')
  @ApiOperation({
    summary:
      'Update current student personal information for a specific school',
  })
  @ApiResponse({
    status: 200,
    description: 'Student personal information updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Student record not found' })
  async updateMyPersonalInfo(
    @CurrentUser() user: UserEntity,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateStudentPersonalInfoDto,
  ) {
    return this.studentsService.updatePersonalInfo(user.id, schoolId, dto);
  }
}
