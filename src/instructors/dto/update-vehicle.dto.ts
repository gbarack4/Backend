import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  year?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsIn(['automatic', 'manual', 'both'])
  @IsOptional()
  transmission?: string;

  @IsIn(['yes', 'no'])
  @IsOptional()
  dualControl?: string;
}
