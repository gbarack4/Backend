import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { SearchInstructorsQueryDto } from './dto/search-instructors-query.dto';
import { InstructorsService } from './instructors.service';

@Controller('public/schools/:schoolId/instructors')
export class PublicInstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get()
  async searchInstructors(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Query() query: SearchInstructorsQueryDto,
  ) {
    return this.instructorsService.searchPublicInstructors(
      schoolId,
      query.suburb,
      query.transmission,
      query.preferredDate,
    );
  }

  @Get(':instructorId')
  async getPublicInstructor(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Param('instructorId', new ParseUUIDPipe({ version: '4' }))
    instructorId: string,
    @Query() query: SearchInstructorsQueryDto,
  ) {
    if (!query.preferredDate) {
      throw new BadRequestException('preferredDate is required');
    }

    return this.instructorsService.getPublicInstructorById(
      schoolId,
      instructorId,
      query.suburb,
      query.preferredDate,
    );
  }
}
