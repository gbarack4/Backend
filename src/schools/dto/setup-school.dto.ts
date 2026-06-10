import { IsString, IsOptional, MinLength, IsUrl } from 'class-validator';

export class SetupSchoolDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  googleBusinessUrl?: string;
}
