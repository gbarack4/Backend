import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { SchoolRolesGuard } from '@/auth/guards/school-roles.guard';

import { CreateLocationGroupDto } from './dto/create-location-group.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdateHourlyRateDto } from './dto/update-hourly-rate.dto';
import { UpdateLocationGroupDto } from './dto/update-location-group.dto';
import { SchoolPackagesService } from './school-packages.service';

@Controller('school-admin')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, SchoolRolesGuard)
@Roles(Role.Owner, Role.Admin)
export class SchoolPackagesController {
  constructor(private readonly schoolPackagesService: SchoolPackagesService) {}

  @Get('location-groups/:schoolId')
  async getLocationGroups(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.schoolPackagesService.getLocationGroups(schoolId);
  }

  @Post('location-groups')
  async createLocationGroup(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: CreateLocationGroupDto,
  ) {
    return this.schoolPackagesService.createLocationGroup(schoolId, dto);
  }

  @Get('packages/:schoolId')
  async getPackages(@Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string) {
    return this.schoolPackagesService.getPackages(schoolId);
  }

  @Post('packages')
  async createPackage(@Headers('x-school-id') schoolId: string, @Body() dto: CreatePackageDto) {
    return this.schoolPackagesService.createPackage(schoolId, dto);
  }

  @Patch('schools/hourly-rate')
  async updateHourlyRate(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: UpdateHourlyRateDto,
  ) {
    return this.schoolPackagesService.updateHourlyRate(schoolId, dto.hourlyRate);
  }

  @Patch('location-groups/:id')
  async updateLocationGroup(
    @Headers('x-school-id') schoolId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLocationGroupDto,
  ) {
    return this.schoolPackagesService.updateLocationGroup(schoolId, id, dto);
  }

  @Delete('location-groups/:id')
  async deleteLocationGroup(
    @Headers('x-school-id') schoolId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.schoolPackagesService.deleteLocationGroup(schoolId, id);
  }

  @Get('schools/hourly-rate/:schoolId')
  async getHourlyRate(@Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string) {
    return this.schoolPackagesService.getHourlyRate(schoolId);
  }

  @Patch('packages/:id')
  async updatePackage(
    @Headers('x-school-id') schoolId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: Partial<CreatePackageDto>,
  ) {
    return this.schoolPackagesService.updatePackage(schoolId, id, dto);
  }

  @Patch('packages/:id/status')
  async updatePackageStatus(
    @Headers('x-school-id') schoolId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('status') status: 'active' | 'archived',
  ) {
    return this.schoolPackagesService.updatePackageStatus(schoolId, id, status);
  }

  @Delete('packages/:id')
  async deletePackage(
    @Headers('x-school-id') schoolId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.schoolPackagesService.deletePackage(schoolId, id);
  }
}
