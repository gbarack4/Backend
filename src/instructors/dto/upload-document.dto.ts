import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
