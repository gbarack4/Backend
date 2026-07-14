import { Module } from '@nestjs/common';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';
import { DatabaseModule } from '@/database/database.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
