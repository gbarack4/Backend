import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GetAvailableSlotsDto {
  @IsDateString(
    {},
    {
      message: 'Date must be a valid ISO date string, e.g., 2026-08-25',
    },
  )
  date!: string;

  @IsString()
  @IsNotEmpty()
  suburb!: string;

  @IsUUID('4', { message: 'instructorId must be a valid UUID' })
  @IsNotEmpty()
  instructorId!: string;

  @IsUUID('4', { message: 'packageId must be a valid UUID' })
  @IsNotEmpty()
  packageId!: string;
}
