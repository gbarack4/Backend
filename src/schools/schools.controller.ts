import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '../auth/guards/require-db-user.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserEntity } from '../auth/interfaces/auth.interface';

@Controller('schools')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post('setup')
  async setup(@CurrentUser() user: UserEntity, @Body() dto: SetupSchoolDto) {
    return this.schoolsService.setupNewSchool(user.id, dto);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: UserEntity) {
    return await this.schoolsService.getSchoolSettings(user.id);
  }
}
