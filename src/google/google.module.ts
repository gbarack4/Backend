import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/database/database.module';
import { UsersModule } from '@/users/users.module';

import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { TimezoneService } from './timezone.service';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [GoogleController],
  providers: [GoogleService, TimezoneService],
  exports: [GoogleService, TimezoneService],
})
export class GoogleModule {}
