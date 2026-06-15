import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SchoolsModule } from './schools/schools.module';
import clerkConfig from './config/clerk.config';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { GoogleModule } from './google/google.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [clerkConfig],
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    StorageModule,
    GoogleModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
