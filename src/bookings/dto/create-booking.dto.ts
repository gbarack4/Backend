import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  pickupAddress!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  pickupLatitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  pickupLongitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pickupGooglePlaceId?: string;

  @IsDateString()
  startDatetime!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
