import {
  Controller,
  Post,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadType } from './dto/get-presigned-url.dto';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { SchoolRolesGuard } from '@/auth/guards/school-roles.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PRESIGNED_UPLOAD_BYTES } from './constants/storage.constants';

const fileValidationPipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_PRESIGNED_UPLOAD_BYTES }),
  ],
});

@Controller('upload')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, SchoolRolesGuard)
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('school-logo')
  @RequirePermission('edit')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSchoolLogo(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @Headers('x-school-id') schoolId: string,
  ) {
    // `schoolId` presence, school membership, and the granular edit permission
    // are already validated by SchoolRolesGuard before this handler runs.
    return this.s3Service.uploadFileDirectly(
      schoolId,
      file,
      UploadType.SCHOOL_LOGO,
    );
  }

  @Post('school-cover')
  @RequirePermission('edit')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSchoolCover(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @Headers('x-school-id') schoolId: string,
  ) {
    return this.s3Service.uploadFileDirectly(
      schoolId,
      file,
      UploadType.SCHOOL_COVER,
    );
  }
}
