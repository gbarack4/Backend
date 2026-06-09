import { IsString, IsOptional, MinLength, IsUrl } from 'class-validator';

export class SetupSchoolDto {
  @IsString()
  @MinLength(2)
  schoolName!: string;

  @IsString()
  @MinLength(5)
  businessAddress!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  googleBusinessUrl?: string;
}
