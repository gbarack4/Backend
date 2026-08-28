import { Module } from '@nestjs/common';

import { BookingSlotsService } from './booking-slots.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  controllers: [BookingsController, PublicBookingsController],
  providers: [BookingsService, BookingSlotsService],
  exports: [BookingsService, BookingSlotsService],
})
export class BookingsModule {}
