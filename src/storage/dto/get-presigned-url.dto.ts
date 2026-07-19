import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum UploadType {
  SCHOOL_LOGO = 'school_logo',
  SCHOOL_COVER = 'school_cover',
  USER_AVATAR = 'user_avatar',
  INSTRUCTOR_AVATAR = 'instructor_avatar',
  INSTRUCTOR_DOCUMENT = 'instructor_document',
}

export class GetPresignedUrlDto {
  @IsEnum(UploadType, { message: 'Invalid upload type' })
  type!: UploadType;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
