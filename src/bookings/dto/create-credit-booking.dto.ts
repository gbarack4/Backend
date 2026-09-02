import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDivisibleBy,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCreditBookingDto {
  @IsUUID('4')
  instructorId!: string;

  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startDatetime must include a timezone',
  })
  startDatetime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(180)
  @IsDivisibleBy(15)
  durationMinutes!: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  pickupSuburb!: string;

  @IsOptional()
  @IsString()
  pickupPostcode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsUUID('4')
  idempotencyKey!: string;
}
