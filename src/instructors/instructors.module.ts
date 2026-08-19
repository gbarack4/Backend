import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/database/database.module';
import { UsersModule } from '@/users/users.module';

import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
