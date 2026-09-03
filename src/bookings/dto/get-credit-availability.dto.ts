import { Type } from 'class-transformer';
import { IsDivisibleBy, IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

export class GetCreditAvailabilityDto {
  @IsUUID('4')
  instructorId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(180)
  @IsDivisibleBy(15)
  durationMinutes!: number;
}
