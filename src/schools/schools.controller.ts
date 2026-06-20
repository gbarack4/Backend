import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '../auth/guards/require-db-user.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserEntity } from '../auth/interfaces/auth.interface';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { UpdateSchoolLogoDto } from './dto/update-school-logo.dto';
import { UpdateSchoolCoverImageDto } from './dto/update-school-cover-image.dto';
import { SchoolRolesGuard } from '../auth/guards/school-roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@Controller('schools')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post('setup')
  async setup(@CurrentUser() user: UserEntity, @Body() dto: SetupSchoolDto) {
    return this.schoolsService.setupNewSchool(user.id, dto);
  }

  @Get('default')
  async getDefaultSchool(@CurrentUser() user: UserEntity) {
    const defaultSchool = await this.schoolsService.getDefaultSchool(user.id);

    if (!defaultSchool) {
      throw new NotFoundException('No schools found for this user');
    }

    return defaultSchool;
  }

  @Get('settings')
  @UseGuards(SchoolRolesGuard)
  async getSettings(@Headers('x-school-id') schoolId: string) {
    return this.schoolsService.getSchoolSettings(schoolId);
  }

  @Patch('settings')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  async updateSettings(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateSchoolSettingsDto,
  ) {
    return this.schoolsService.updateSchoolSettings(schoolId, dto);
  }

  @Patch('logo')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  async updateSchoolLogo(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateSchoolLogoDto,
  ) {
    return this.schoolsService.updateSchoolLogo(schoolId, dto.logoUrl);
  }

  @Patch('cover')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  async updateSchoolCoverImage(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateSchoolCoverImageDto,
  ) {
    return this.schoolsService.updateSchoolCoverImage(
      schoolId,
      dto.coverImageUrl,
    );
  }
}
