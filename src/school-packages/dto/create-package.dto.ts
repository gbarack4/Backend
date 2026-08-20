import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreatePackageDto {
  @IsUUID()
  locationGroupId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}
