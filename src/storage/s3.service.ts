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
  ALLOWED_EXTENSIONS,
  MAX_PRESIGNED_UPLOAD_BYTES,
} from './constants/storage.constants';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);

  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('AWS_REGION');
    this.bucketName =
      this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');

    const accessKeyId =
      this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.getOrThrow<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------

  private resolveFileExtension(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        `Unsupported file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    return extension;
  }

  private buildUniqueFileName(originalName: string): string {
    const extension = this.resolveFileExtension(originalName);
    return `${uuidv4()}.${extension}`;
  }

  private buildFileUrl(s3Key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  private buildSchoolS3KeyForPresigned(
    schoolId: string,
    type: UploadType,
    uniqueFileName: string,
  ): string {
    switch (type) {
      case UploadType.SCHOOL_LOGO:
        if (!schoolId)
          throw new BadRequestException(
            'School ID is required for logo upload',
          );
        return `schools/${schoolId}/logo-${uniqueFileName}`;
      case UploadType.SCHOOL_COVER:
        if (!schoolId)
          throw new BadRequestException(
            'School ID is required for cover upload',
          );
        return `schools/${schoolId}/cover-${uniqueFileName}`;
      case UploadType.USER_AVATAR:
        return `users/avatars/${uniqueFileName}`;
      default:
        throw new BadRequestException('Unsupported upload type');
    }
  }

  private async executeUpload(s3Key: string, file: Express.Multer.File) {
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
      this.logger.error(`Error uploading file to S3 (key: ${s3Key})`, error);
      throw new BadRequestException('Could not upload file');
    }
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  async generatePresignedUrl(schoolId: string, dto: GetPresignedUrlDto) {
    const uniqueFileName = this.buildUniqueFileName(dto.fileName);
    const s3Key = this.buildSchoolS3KeyForPresigned(
      schoolId,
      dto.type,
      uniqueFileName,
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: dto.contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300,
      });

      return {
        presignedUrl,
        fileUrl: this.buildFileUrl(s3Key),
        key: s3Key,
        // Returned for the client to enforce before upload. PutObjectCommand
        // presigned URLs cannot enforce a server-side size limit on their own.
        // For a hard guarantee enforced by S3 itself, use
        // `generatePresignedPost` instead.
        maxSizeBytes: MAX_PRESIGNED_UPLOAD_BYTES,
      };
    } catch (error) {
      this.logger.error('Error generating presigned URL', error);
      throw new BadRequestException('Could not generate upload URL');
    }
  }

  /**
   * Same purpose as `generatePresignedUrl`, but enforces a hard server-side
   * file size limit via S3's `content-length-range` policy condition —
   * S3 itself rejects oversized uploads, instead of relying on the client
   * to respect `maxSizeBytes`.
   *
   * Frontend usage differs from the PUT-based flow: the client must POST
   * a `multipart/form-data` request to `url`, including every entry from
   * `fields` as form fields, with the file appended last under the `file` key.
   *
   *   const formData = new FormData();
   *   Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
   *   formData.append('file', file);
   *   await fetch(url, { method: 'POST', body: formData });
   */
  async generatePresignedPost(schoolId: string, dto: GetPresignedUrlDto) {
    const uniqueFileName = this.buildUniqueFileName(dto.fileName);
    const s3Key = this.buildSchoolS3KeyForPresigned(
      schoolId,
      dto.type,
      uniqueFileName,
    );

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
        Expires: 300,
      });

      return {
        url,
        fields,
        fileUrl: this.buildFileUrl(s3Key),
        key: s3Key,
        maxSizeBytes: MAX_PRESIGNED_UPLOAD_BYTES,
      };
    } catch (error) {
      this.logger.error('Error generating presigned post', error);
      throw new BadRequestException('Could not generate upload URL');
    }
  }

  /**
   * Uploads a school-scoped file (logo or cover image).
   * schoolId is required and validated before upload.
   */
  async uploadSchoolFile(
    schoolId: string,
    file: Express.Multer.File,
    type: UploadType.SCHOOL_LOGO | UploadType.SCHOOL_COVER,
  ) {
    if (!schoolId) {
      throw new BadRequestException('School ID is required for school uploads');
    }

    const uniqueFileName = this.buildUniqueFileName(file.originalname);
    const prefix = type === UploadType.SCHOOL_LOGO ? 'logo' : 'cover';
    const s3Key = `schools/${schoolId}/${prefix}-${uniqueFileName}`;

    return this.executeUpload(s3Key, file);
  }

  /**
   * Uploads a user avatar. No schoolId needed.
   */
  async uploadUserAvatar(file: Express.Multer.File) {
    const uniqueFileName = this.buildUniqueFileName(file.originalname);
    const s3Key = `users/avatars/${uniqueFileName}`;

    return this.executeUpload(s3Key, file);
  }

  /**
   * Deletes a file from S3 given its full public URL or raw S3 key.
   * Never throws — failures are logged and swallowed, since this is
   * typically called as best-effort cleanup after a DB transaction commits.
   */
  async deleteFile(fileUrlOrKey: string): Promise<void> {
    if (!fileUrlOrKey) return;

    try {
      const baseUrl = this.buildFileUrl('');
      const s3Key = fileUrlOrKey.startsWith(baseUrl)
        ? fileUrlOrKey.replace(baseUrl, '')
        : fileUrlOrKey;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from S3: ${fileUrlOrKey}`,
        error,
      );
    }
  }
}
