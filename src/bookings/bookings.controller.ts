import { Controller, Get, Query } from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';

@Controller('slots')
export class BookingsController {
  constructor(private readonly BookingsService: BookingsService) {}

  @Get('available')
  async getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.BookingsService.getAvailableSlots(dto);
  }
}
