import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadAvatarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oldFileUrl?: string | null;
}
