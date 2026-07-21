import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WebhooksController } from './webhooks.controller';
import { StudentsModule } from '@/students/students.module';

@Global()
@Module({
  imports: [StudentsModule],
  controllers: [UsersController, WebhooksController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
