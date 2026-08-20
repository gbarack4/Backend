import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import clerkConfig from './config/clerk.config';
import { DatabaseModule } from './database/database.module';
import { GoogleModule } from './google/google.module';
import { InstructorSchoolsModule } from './instructor-schools/instructor-schools.module';
import { InstructorsModule } from './instructors/instructors.module';
import { PublicWebsitesModule } from './public-websites/public-websites.module';
import { SchoolPackagesModule } from './school-packages/school-packages.module';
import { SchoolsModule } from './schools/schools.module';
import { StorageModule } from './storage/storage.module';
import { StudentsModule } from './students/students.module';
import { UsersModule } from './users/users.module';

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
    PublicWebsitesModule,
    InstructorsModule,
    StudentsModule,
    InstructorSchoolsModule,
    AvailabilityModule,
    SchoolPackagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
