import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { v4 as uuidv4 } from 'uuid';

import { GetPresignedUrlDto, UploadType } from './dto/get-presigned-url.dto';
import {
  UploadResponseDto,
  PresignedPutResponseDto,
  PresignedPostResponseDto,
} from './dto/upload-responses.dto';
import {
  ALLOWED_FILE_TYPES,
  AllowedExtension,
  MAX_PRESIGNED_UPLOAD_BYTES,
  PRESIGNED_URL_TTL_SECONDS,
} from './constants/storage.constants';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);

  private readonly bucketName: string;
  private readonly region: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('AWS_REGION');
    this.bucketName =
      this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');
    this.publicBaseUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    const accessKeyId =
      this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.getOrThrow<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.s3Client = new S3Client({
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  // ---------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? `${error.name}: ${error.message}`;
    }

    return String(error);
  }

  private isAllowedExtension(extension: string): extension is AllowedExtension {
    return Object.hasOwn(ALLOWED_FILE_TYPES, extension);
  }

  private getFileExtension(fileName: string): AllowedExtension {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (!extension || !this.isAllowedExtension(extension)) {
      const allowedExtensions = Object.keys(ALLOWED_FILE_TYPES).join(', ');
      throw new BadRequestException(
        `Unsupported file extension. Allowed: ${allowedExtensions}`,
      );
    }

    return extension;
  }

  private validateFile(extension: AllowedExtension, mimeType?: string): void {
    if (mimeType && ALLOWED_FILE_TYPES[extension] !== mimeType) {
      throw new BadRequestException(
        `MIME type mismatch. Extension .${extension} expects content type: ${ALLOWED_FILE_TYPES[extension]}`,
      );
    }
  }

  private generateUniqueFileName(
    originalName: string,
    mimeType?: string,
  ): string {
    const extension = this.getFileExtension(originalName);
    this.validateFile(extension, mimeType);

    return `${uuidv4()}.${extension}`;
  }

  private buildFileUrl(s3Key: string): string {
    return `${this.publicBaseUrl}/${s3Key}`;
  }

  private buildS3Key(
    type: UploadType,
    uniqueFileName: string,
    schoolId?: string,
  ): string {
    if (
      (type === UploadType.SCHOOL_LOGO || type === UploadType.SCHOOL_COVER) &&
      !schoolId
    ) {
      throw new BadRequestException('School ID is required for school uploads');
    }

    switch (type) {
      case UploadType.SCHOOL_LOGO:
        return `schools/${schoolId}/logo-${uniqueFileName}`;
      case UploadType.SCHOOL_COVER:
        return `schools/${schoolId}/cover-${uniqueFileName}`;
      case UploadType.USER_AVATAR:
        return `users/avatars/${uniqueFileName}`;
      case UploadType.INSTRUCTOR_AVATAR:
        return `instructors/avatars/${uniqueFileName}`;
      case UploadType.INSTRUCTOR_DOCUMENT:
        return `instructors/documents/${uniqueFileName}`;
      default: {
        const _: never = type;
        throw new Error(`Unreachable: Unsupported upload type ${String(_)}`);
      }
    }
  }

  private async executeUpload(
    s3Key: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);

      return {
        fileUrl: this.buildFileUrl(s3Key),
        key: s3Key,
      };
    } catch (error) {
      this.logger.error(
        `Error uploading file to S3 (key: ${s3Key})`,
        this.formatError(error),
      );
      throw new BadRequestException('Could not upload file');
    }
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  async generatePresignedUrl(
    schoolId: string,
    dto: GetPresignedUrlDto,
  ): Promise<PresignedPutResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      dto.fileName,
      dto.contentType,
    );
    const s3Key = this.buildS3Key(dto.type, uniqueFileName, schoolId);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: dto.contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: PRESIGNED_URL_TTL_SECONDS,
      });

      return {
        presignedUrl,
        fileUrl: this.buildFileUrl(s3Key),
        key: s3Key,
        maxSizeBytes: MAX_PRESIGNED_UPLOAD_BYTES,
      };
    } catch (error) {
      this.logger.error(
        'Error generating presigned URL',
        this.formatError(error),
      );
      throw new BadRequestException('Could not generate upload URL');
    }
  }

  async generatePresignedPost(
    schoolId: string,
    dto: GetPresignedUrlDto,
  ): Promise<PresignedPostResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      dto.fileName,
      dto.contentType,
    );
    const s3Key = this.buildS3Key(dto.type, uniqueFileName, schoolId);

    try {
      const { url, fields } = await createPresignedPost(this.s3Client, {
        Bucket: this.bucketName,
        Key: s3Key,
        Conditions: [
          ['content-length-range', 0, MAX_PRESIGNED_UPLOAD_BYTES],
          ['eq', '$Content-Type', dto.contentType],
        ],
        Fields: {
          'Content-Type': dto.contentType,
        },
        Expires: PRESIGNED_URL_TTL_SECONDS,
      });

      return {
        url,
        fields,
        fileUrl: this.buildFileUrl(s3Key),
        key: s3Key,
        maxSizeBytes: MAX_PRESIGNED_UPLOAD_BYTES,
      };
    } catch (error) {
      this.logger.error(
        'Error generating presigned post',
        this.formatError(error),
      );
      throw new BadRequestException('Could not generate upload URL');
    }
  }

  async uploadSchoolFile(
    schoolId: string,
    file: Express.Multer.File,
    type: UploadType.SCHOOL_LOGO | UploadType.SCHOOL_COVER,
  ): Promise<UploadResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      file.originalname,
      file.mimetype,
    );
    const s3Key = this.buildS3Key(type, uniqueFileName, schoolId);

    return this.executeUpload(s3Key, file);
  }

  async uploadUserAvatar(
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      file.originalname,
      file.mimetype,
    );
    const s3Key = this.buildS3Key(UploadType.USER_AVATAR, uniqueFileName);

    return this.executeUpload(s3Key, file);
  }

  async uploadInstructorAvatar(
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      file.originalname,
      file.mimetype,
    );
    const s3Key = this.buildS3Key(UploadType.INSTRUCTOR_AVATAR, uniqueFileName);

    return this.executeUpload(s3Key, file);
  }

  async deleteFile(fileUrlOrKey: string): Promise<void> {
    if (!fileUrlOrKey) return;

    try {
      const prefix = `${this.publicBaseUrl}/`;
      const s3Key = fileUrlOrKey.startsWith(prefix)
        ? fileUrlOrKey.slice(prefix.length)
        : fileUrlOrKey;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from S3: ${fileUrlOrKey}`,
        this.formatError(error),
      );
    }
  }

  async uploadInstructorDocument(
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const uniqueFileName = this.generateUniqueFileName(
      file.originalname,
      file.mimetype,
    );
    const s3Key = this.buildS3Key(
      UploadType.INSTRUCTOR_DOCUMENT,
      uniqueFileName,
    );

    return this.executeUpload(s3Key, file);
  }
}
