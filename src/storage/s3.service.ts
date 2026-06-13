import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { GetPresignedUrlDto, UploadType } from './dto/get-presigned-url.dto';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing required AWS S3 environment variables');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async generatePresignedUrl(schoolId: string, dto: GetPresignedUrlDto) {
    const fileExtension = dto.fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    let s3Key = '';

    if (dto.type === UploadType.SCHOOL_LOGO) {
      if (!schoolId)
        throw new BadRequestException('School ID is required for logo upload');
      s3Key = `schools/${schoolId}/logo-${uniqueFileName}`;
    } else if (dto.type === UploadType.USER_AVATAR) {
      s3Key = `users/avatars/${uniqueFileName}`;
    } else {
      throw new BadRequestException('Unsupported upload type');
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: dto.contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300,
      });

      return {
        presignedUrl,
        fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        key: s3Key,
      };
    } catch (error) {
      this.logger.error('Error generating presigned URL', error);
      throw new BadRequestException('Could not generate upload URL');
    }
  }

  async deleteFile(fileUrl: string) {
    if (!fileUrl) return;

    try {
      const baseUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
      const s3Key = fileUrl.replace(baseUrl, '');

      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${fileUrl}`, error);
    }
  }

  async uploadFileDirectly(
    schoolId: string,
    file: Express.Multer.File,
    type: UploadType,
  ) {
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    let s3Key = '';

    if (type === UploadType.SCHOOL_LOGO) {
      if (!schoolId) {
        throw new BadRequestException('School ID is required for logo upload');
      }
      s3Key = `schools/${schoolId}/logo-${uniqueFileName}`;
    } else if (type === UploadType.USER_AVATAR) {
      s3Key = `users/avatars/${uniqueFileName}`;
    } else {
      throw new BadRequestException('Unsupported upload type');
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);

      return {
        fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        key: s3Key,
      };
    } catch (error) {
      this.logger.error('Error uploading file directly to S3', error);
      throw new BadRequestException('Could not upload file');
    }
  }
}
