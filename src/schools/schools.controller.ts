import { Controller, Post, Body, UseGuards, Get, Patch } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '../auth/guards/require-db-user.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserEntity } from '../auth/interfaces/auth.interface';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { UpdateSchoolLogoDto } from './dto/update-school-logo.dto';
import { UpdateSchoolCoverImageDto } from './dto/update-school-cover-image.dto';

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
    return this.schoolsService.getSchoolSettings(user.id);
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateSchoolSettingsDto,
  ) {
    return this.schoolsService.updateSchoolSettings(user.id, dto);
  }

  @Patch('logo')
  async updateSchoolLogo(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateSchoolLogoDto,
  ) {
    return this.schoolsService.updateSchoolLogo(user.id, dto.logoUrl);
  }

  @Patch('cover')
  async updateSchoolCoverImage(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateSchoolCoverImageDto,
  ) {
    return this.schoolsService.updateSchoolCoverImage(
      user.id,
      dto.coverImageUrl,
    );
  }
}
