import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [],
  controllers: [UsersController, WebhooksController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
