import { Module } from '@nestjs/common';

import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { SlotsController } from './booking-slots.controller';
import { SlotsService } from './booking-slots.service';

@Module({
  providers: [AvailabilityService, SlotsService],
  controllers: [AvailabilityController, SlotsController],
})
export class AvailabilityModule {}
