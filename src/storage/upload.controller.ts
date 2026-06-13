import {
  Controller,
  Post,
  Headers,
  BadRequestException,
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
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('upload')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('school-logo')
  @Roles('admin', 'owner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSchoolLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Headers('x-school-id') schoolId: string,
  ) {
    if (!schoolId) {
      throw new BadRequestException('Header "x-school-id" is required');
    }

    return await this.s3Service.uploadFileDirectly(
      schoolId,
      file,
      UploadType.SCHOOL_LOGO,
    );
  }
}
