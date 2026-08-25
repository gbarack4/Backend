import { Controller, Get, Query } from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('slots')
  getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.bookingsService.getAvailableSlots(dto);
  }
}
