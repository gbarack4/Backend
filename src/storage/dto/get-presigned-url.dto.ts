import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum UploadType {
  SCHOOL_LOGO = 'school_logo',
  USER_AVATAR = 'user_avatar',
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
