import { IsOptional, IsString } from 'class-validator';
import { BaseSchoolDto } from './base-school.dto';

export class UpdateSchoolSettingsDto extends BaseSchoolDto {
  @IsOptional()
  @IsString()
  domainPrefix?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
