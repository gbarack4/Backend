import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { SyncStudentDto } from './dto/sync-student.dto';

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
}
