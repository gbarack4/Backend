import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { GetPublicPackagesDto } from './dto/get-public-packages.dto';
import { SchoolPackagesService } from './school-packages.service';

@Controller('public/school-packages')
export class PublicSchoolPackagesController {
  constructor(private readonly schoolPackagesService: SchoolPackagesService) {}

  @Get(':schoolId')
  async getPublicPackages(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Query() query: GetPublicPackagesDto,
  ) {
    return this.schoolPackagesService.getPublicPackagesBySuburb(schoolId, query.suburb);
  }
}
