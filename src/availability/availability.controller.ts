import { Controller, Put, Body, UseGuards, Get } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { UpdateDailyAvailabilityDto } from './dto/update-daily-availability.dto';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { CurrentInstructorId } from '@/auth/decorators/current-instructor.decorator';
import { RolesGuard } from '@/auth/guards/roles.guard';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('daily')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  @Roles(Role.Instructor)
  async getAvailability(@CurrentInstructorId() instructorId: string) {
    return this.availabilityService.getInstructorAvailability(instructorId);
  }

  @Put('daily')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  @Roles(Role.Instructor)
  async updateDaily(
    @Body() dto: UpdateDailyAvailabilityDto,
    @CurrentInstructorId() instructorId: string,
  ) {
    return this.availabilityService.updateDailyAvailability(instructorId, dto);
  }
}
