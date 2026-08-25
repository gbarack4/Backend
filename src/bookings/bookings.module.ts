import { Module } from '@nestjs/common';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  controllers: [BookingsController, PublicBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
