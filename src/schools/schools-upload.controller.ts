import {
  Controller,
  Post,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { S3Service } from '@/storage/s3.service';
import { UploadType } from '@/storage/dto/get-presigned-url.dto';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { SchoolRolesGuard } from '@/auth/guards/school-roles.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileValidationPipe } from '@/storage/constants/storage.constants';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Schools & Uploads')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-school-id',
  description:
    'The UUID of the school managing the upload (validated against user ownership/admin roles)',
  required: true,
  schema: { type: 'string', format: 'uuid' },
})
@Controller('upload')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, SchoolRolesGuard)
export class SchoolsUploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('school-logo')
  @RequirePermission('edit')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload driving school logo image to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Logo file (jpeg, png)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Logo successfully uploaded and stored on S3',
  })
  async uploadSchoolLogo(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @Headers('x-school-id') schoolId: string,
  ) {
    // `schoolId` presence, school membership, and the granular edit permission
    // are already validated by SchoolRolesGuard before this handler runs.
    return this.s3Service.uploadSchoolFile(
      schoolId,
      file,
      UploadType.SCHOOL_LOGO,
    );
  }

  @Post('school-cover')
  @RequirePermission('edit')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload driving school cover image to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Cover image file (jpeg, png)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Cover image successfully uploaded and stored on S3',
  })
  async uploadSchoolCover(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @Headers('x-school-id') schoolId: string,
  ) {
    return this.s3Service.uploadSchoolFile(
      schoolId,
      file,
      UploadType.SCHOOL_COVER,
    );
  }
}
