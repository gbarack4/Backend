import { IsNumber, Min } from 'class-validator';

export class UpdateHourlyRateDto {
  @IsNumber()
  @Min(0)
  hourlyRate!: number;
}
