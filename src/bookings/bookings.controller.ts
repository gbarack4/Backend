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

import { CurrentInstructorId } from '@/auth/decorators/current-instructor.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';

import { BookingInstructorsService } from './booking-instructors.service';
import { BookingQueryService } from './booking-query.service';
import { BookingsService } from './bookings.service';
import { CreditBookingAvailabilityService } from './credit-booking-availability.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateCreditBookingDto } from './dto/create-credit-booking.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { GetCreditAvailabilityDto } from './dto/get-credit-availability.dto';
import { GetCreditAvailableSlotsDto } from './dto/get-credit-available-slots.dto';
import { GetInstructorBookingsDto } from './dto/get-instructor-bookings.dto';
import { GetStudentBookingsDto } from './dto/get-student-bookings.dto';
import { SearchSchoolInstructorsDto } from './dto/search-school-instructors.dto';

@Controller('bookings')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingInstructorsService: BookingInstructorsService,
    private readonly bookingQueryService: BookingQueryService,
    private readonly creditBookingAvailabilityService: CreditBookingAvailabilityService,
  ) {}

  @Get('slots')
  @Roles(Role.Student)
  async getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.bookingsService.getAvailableSlots(dto);
  }

  @Get('school/:schoolId/student')
  @Roles(Role.Student)
  async getStudentBookings(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Query() dto: GetStudentBookingsDto,
  ) {
    return this.bookingQueryService.getStudentBookings(user.id, schoolId, dto);
  }

  @Get('instructor')
  @Roles(Role.Instructor)
  async getInstructorBookings(
    @CurrentInstructorId() instructorId: string,
    @Query() dto: GetInstructorBookingsDto,
  ) {
    return this.bookingQueryService.getInstructorBookings(instructorId, dto);
  }

  @Get('school/:schoolId/credit-availability')
  @Roles(Role.Student)
  async getCreditAvailability(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Query() dto: GetCreditAvailabilityDto,
  ) {
    return this.creditBookingAvailabilityService.getAvailability(user.id, schoolId, dto);
  }

  @Get('school/:schoolId/credit-slots')
  @Roles(Role.Student)
  async getCreditAvailableSlots(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Query() dto: GetCreditAvailableSlotsDto,
  ) {
    return this.bookingsService.getCreditAvailableSlots(user.id, schoolId, dto);
  }

  @Get('school/:schoolId/instructors')
  @Roles(Role.Student)
  async getSchoolInstructors(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
  ) {
    return this.bookingInstructorsService.getSchoolInstructors(user.id, schoolId);
  }

  @Get('school/:schoolId/instructors/search')
  @Roles(Role.Student)
  async searchSchoolInstructors(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Query() dto: SearchSchoolInstructorsDto,
  ) {
    return this.bookingInstructorsService.searchSchoolInstructors(user.id, schoolId, dto.query);
  }

  @Post('school/:schoolId/credit')
  @Roles(Role.Student)
  async createCreditBooking(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Body() dto: CreateCreditBookingDto,
  ) {
    return this.bookingsService.createCreditBooking(user.id, schoolId, dto);
  }

  @Post('school/:schoolId')
  @Roles(Role.Student)
  async createBooking(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user.id, schoolId, dto);
  }
}
