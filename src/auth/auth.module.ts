import { Module, Global } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ClerkAuthService } from './clerk-auth.service';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RequireDbUserGuard } from './guards/require-db-user.guard';
import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [ClerkAuthService, ClerkAuthGuard, RequireDbUserGuard],
  exports: [ClerkAuthService, ClerkAuthGuard, RequireDbUserGuard],
})
export class AuthModule {}
