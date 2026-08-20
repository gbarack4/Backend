import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { CurrentInstructorId } from '@/auth/decorators/current-instructor.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';

import { AvailabilityService } from './availability.service';
import { UpdateBulkAvailabilityDto } from './dto/update-bulk-availability.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('daily')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  @Roles(Role.Instructor)
  async getAvailability(@CurrentInstructorId() instructorId: string) {
    return this.availabilityService.getInstructorAvailability(instructorId);
  }

  @Put('bulk')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  @Roles(Role.Instructor)
  async updateBulk(
    @Body() dto: UpdateBulkAvailabilityDto,
    @CurrentInstructorId() instructorId: string,
  ) {
    return this.availabilityService.updateBulkAvailability(instructorId, dto);
  }
}
