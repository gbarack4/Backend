import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { DatabaseModule } from '@/database/database.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
