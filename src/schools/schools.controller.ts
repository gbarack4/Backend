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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Schools Management')
@ApiBearerAuth()
@Controller('schools')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Setup and initialize a new driving school' })
  @ApiResponse({
    status: 201,
    description: 'School successfully created and initialized',
  })
  async setup(@CurrentUser() user: UserEntity, @Body() dto: SetupSchoolDto) {
    return this.schoolsService.setupNewSchool(user.id, dto);
  }

  @Get('default')
  @ApiOperation({
    summary: 'Get the default associated school for the current user',
  })
  @ApiResponse({ status: 200, description: 'Returns default school entity' })
  @ApiResponse({ status: 404, description: 'No schools found for this user' })
  async getDefaultSchool(@CurrentUser() user: UserEntity) {
    const defaultSchool = await this.schoolsService.getDefaultSchool(user.id);

    if (!defaultSchool) {
      throw new NotFoundException('No schools found for this user');
    }

    return defaultSchool;
  }

  @Get('settings')
  @UseGuards(SchoolRolesGuard)
  @ApiOperation({
    summary: 'Get core configuration and settings for a specific school',
  })
  @ApiHeader({
    name: 'x-school-id',
    description: 'The UUID of the target school',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 200,
    description: 'Returns school configuration payload',
  })
  async getSettings(@Headers('x-school-id') schoolId: string) {
    return this.schoolsService.getSchoolSettings(schoolId);
  }

  @Patch('settings')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  @ApiOperation({
    summary: 'Update metadata and configuration parameters for a school',
  })
  @ApiHeader({
    name: 'x-school-id',
    description: 'The UUID of the target school',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 200,
    description: 'School settings successfully synchronized',
  })
  async updateSettings(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateSchoolSettingsDto,
  ) {
    return this.schoolsService.updateSchoolSettings(schoolId, dto);
  }

  @Patch('logo')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  @ApiOperation({ summary: 'Update driving school logo asset URL' })
  @ApiHeader({
    name: 'x-school-id',
    description: 'The UUID of the target school',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 200,
    description: 'Logo reference successfully stored',
  })
  async updateSchoolLogo(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateSchoolLogoDto,
  ) {
    return this.schoolsService.updateSchoolLogo(schoolId, dto.logoUrl);
  }

  @Patch('cover')
  @UseGuards(SchoolRolesGuard)
  @RequirePermission('edit')
  @ApiOperation({ summary: 'Update driving school dashboard cover asset URL' })
  @ApiHeader({
    name: 'x-school-id',
    description: 'The UUID of the target school',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 200,
    description: 'Cover image reference successfully stored',
  })
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
