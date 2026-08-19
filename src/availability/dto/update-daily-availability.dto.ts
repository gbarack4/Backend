import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class BreakDto {
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, { message: 'Format must be HH:mm' })
  startTime!: string;

  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, { message: 'Format must be HH:mm' })
  endTime!: string;
}

export class UpdateDailyAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isWorking!: boolean;

  @ValidateIf((o: UpdateDailyAvailabilityDto) => o.isWorking === true)
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, { message: 'Format must be HH:mm' })
  startTime?: string;

  @ValidateIf((o: UpdateDailyAvailabilityDto) => o.isWorking === true)
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, { message: 'Format must be HH:mm' })
  endTime?: string;

  @IsInt()
  slotInterval!: number;

  @IsInt()
  travelTime!: number;

  @IsArray()
  @IsString({ each: true })
  locations!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakDto)
  breaks!: BreakDto[];
}
