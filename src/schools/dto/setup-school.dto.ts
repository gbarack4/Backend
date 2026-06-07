import { IsString, IsOptional, MinLength } from 'class-validator';

export class SetupSchoolDto {
  @IsString()
  @MinLength(2)
  schoolName!: string;

  @IsString()
  @MinLength(5)
  businessAddress!: string;

  @IsOptional()
  @IsString()
  googleReviewsApiKey?: string;
}
