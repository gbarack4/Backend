import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';

@Controller('bookings')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('slots')
  @Roles(Role.Student)
  async getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.bookingsService.getAvailableSlots(dto);
  }

  @Post('school/:schoolId')
  @Roles(Role.Student)
  async createBooking(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user.id, schoolId, dto);
  }
}
