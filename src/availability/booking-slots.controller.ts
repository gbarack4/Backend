import { Controller, Get, Query } from '@nestjs/common';

import { SlotsService } from './booking-slots.service';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('available')
  async getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.slotsService.getAvailableSlots(dto);
  }
}
