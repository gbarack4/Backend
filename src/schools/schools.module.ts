import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '@/storage/storage.module';

@Module({
  imports: [DatabaseModule, UsersModule, StorageModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
