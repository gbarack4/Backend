import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty()
  fileUrl!: string;

  @ApiProperty()
  key!: string;
}

export class PresignedPutResponseDto extends UploadResponseDto {
  @ApiProperty()
  presignedUrl!: string;

  @ApiProperty()
  maxSizeBytes!: number;
}

export class PresignedPostResponseDto extends UploadResponseDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  fields!: Record<string, string>;

  @ApiProperty()
  maxSizeBytes!: number;
}
