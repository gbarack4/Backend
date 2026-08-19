import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadAvatarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oldFileUrl?: string | null;
}
