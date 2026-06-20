import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSchoolLogoDto {
  @IsString()
  @IsNotEmpty()
  logoUrl!: string;
}
