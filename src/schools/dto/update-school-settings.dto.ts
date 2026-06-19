import { IsIn, IsOptional, IsString } from 'class-validator';
import { BaseSchoolDto } from './base-school.dto';

export class UpdateSchoolSettingsDto extends BaseSchoolDto {
  @IsOptional()
  @IsString()
  domainPrefix?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsString()
  @IsIn(['onboarding', 'active', 'suspended'], {
    message: 'Status must be either active or closed',
  })
  status!: string;
}
