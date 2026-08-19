import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oldFileUrl?: string;
}
