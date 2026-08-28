import { Module } from '@nestjs/common';

import { BookingsModule } from '@/bookings/bookings.module';
import { DatabaseModule } from '@/database/database.module';
import { SchoolPackagesModule } from '@/school-packages/school-packages.module';
import { UsersModule } from '@/users/users.module';

import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';
import { PublicInstructorsController } from './public-instructors.controller';

@Module({
  imports: [DatabaseModule, UsersModule, BookingsModule, SchoolPackagesModule],
  controllers: [InstructorsController, PublicInstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
