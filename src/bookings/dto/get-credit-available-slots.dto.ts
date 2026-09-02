import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDivisibleBy,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class GetCreditAvailableSlotsDto {
  @IsUUID('4')
  instructorId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  suburb!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(180)
  @IsDivisibleBy(15)
  durationMinutes!: number;
}
