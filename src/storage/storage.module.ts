import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { S3Service } from './s3.service';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [UploadController],
  providers: [S3Service],
  exports: [S3Service],
})
export class StorageModule {}
