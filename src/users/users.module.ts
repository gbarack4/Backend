import { Global, Module } from '@nestjs/common';

import { StudentsModule } from '@/students/students.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  imports: [StudentsModule],
  controllers: [UsersController, WebhooksController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
