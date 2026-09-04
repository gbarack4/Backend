import { Module } from '@nestjs/common';

import { CreditsModule } from '@/credits/credits.module';

import { BookingInstructorsService } from './booking-instructors.service';
import { BookingQueryService } from './booking-query.service';
import { BookingSlotsService } from './booking-slots.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CreditBookingAvailabilityService } from './credit-booking-availability.service';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  imports: [CreditsModule],
  controllers: [BookingsController, PublicBookingsController],
  providers: [
    BookingsService,
    BookingSlotsService,
    BookingQueryService,
    BookingInstructorsService,
    CreditBookingAvailabilityService,
  ],
  exports: [BookingsService, BookingSlotsService],
})
export class BookingsModule {}
