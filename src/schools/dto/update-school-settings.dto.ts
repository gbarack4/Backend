import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseSchoolDto } from './base-school.dto';

export class UpdateSchoolSettingsDto extends BaseSchoolDto {
  @ApiPropertyOptional({
    description:
      'Custom subdomain prefix for the driving school platform (e.g., "apex" for apex.drivinginstructor.pro)',
    example: 'apex',
  })
  @IsOptional()
  @IsString()
  domainPrefix?: string;
}
