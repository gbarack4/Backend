import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '../auth/guards/require-db-user.guard';
import { SchoolRolesGuard } from '../auth/guards/school-roles.guard';
import type { UserEntity } from '../auth/interfaces/auth.interface';
import { SearchSchoolsDto } from './dto/search-schools.dto';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { UpdateSchoolCoverImageDto } from './dto/update-school-cover-image.dto';
import { UpdateSchoolLogoDto } from './dto/update-school-logo.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { SchoolMediaService } from './school-media.service';
import { SchoolSearchService } from './school-search.service';
import { SchoolSettingsService } from './school-settings.service';
import { SchoolSetupService } from './school-setup.service';
import { SchoolsService } from './schools.service';

@ApiTags('Schools Management')
@ApiBearerAuth()
@Controller('schools')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly schoolSetupService: SchoolSetupService,
    private readonly schoolSettingsService: SchoolSettingsService,
    private readonly schoolMediaService: SchoolMediaService,
    private readonly schoolSearchService: SchoolSearchService,
  ) {}

  @Post('setup')
  @ApiOperation({ summary: 'Setup and initialize a new driving school' })
  @ApiResponse({
    status: 201,
    description: 'School successfully created and initialized',
  })
  async setup(@CurrentUser() user: UserEntity, @Body() dto: SetupSchoolDto) {
    return this.schoolSetupService.setupNewSchool(user.id, dto);
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
    return this.schoolSettingsService.getSchoolSettings(schoolId);
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
    return this.schoolSettingsService.updateSchoolSettings(schoolId, dto);
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
    return this.schoolMediaService.updateSchoolLogo(schoolId, dto.logoUrl);
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
    return this.schoolMediaService.updateSchoolCoverImage(schoolId, dto.coverImageUrl);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for driving schools (Instructor Portal)' })
  @ApiResponse({
    status: 200,
    description: 'Returns an array of schools matching the search criteria',
  })
  async search(@CurrentUser() user: UserEntity, @Query() query: SearchSchoolsDto) {
    return this.schoolSearchService.searchSchools(query, user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get actively joined schools for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns an array of schools the instructor has actively joined',
  })
  async getActiveSchools(@CurrentUser() user: UserEntity, @Query('q') q?: string) {
    return this.schoolSearchService.getActiveJoinedSchools(user.id, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driving school by its unique identifier' })
  @ApiResponse({ status: 200, description: 'Returns school entity' })
  @ApiResponse({ status: 404, description: 'School not found' })
  async getSchoolById(
    @CurrentUser() user: UserEntity,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.schoolsService.getSchoolById(id, user.id);
  }
}
