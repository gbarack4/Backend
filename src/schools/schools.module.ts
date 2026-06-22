import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsUploadController } from './schools-upload.controller';
import { SchoolsService } from './schools.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [SchoolsController, SchoolsUploadController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
