import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4')
  instructorId!: string;

  @IsUUID('4')
  packageId!: string;

  @IsString()
  @IsNotEmpty()
  pickupSuburb!: string;

  @IsString()
  @IsOptional()
  pickupPostcode?: string;

  @IsDateString()
  startDatetime!: string;

  @IsDateString()
  endDatetime!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
