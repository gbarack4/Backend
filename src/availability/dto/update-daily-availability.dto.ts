import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class BreakDto {
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, {
    message: 'Format must be HH:mm',
  })
  startTime!: string;

  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, {
    message: 'Format must be HH:mm',
  })
  endTime!: string;
}

class AvailabilityLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  suburb!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string | null;

  @Type(() => Number)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class UpdateDailyAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isWorking!: boolean;

  @ValidateIf((o: UpdateDailyAvailabilityDto) => o.isWorking === true)
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, {
    message: 'Format must be HH:mm',
  })
  startTime?: string;

  @ValidateIf((o: UpdateDailyAvailabilityDto) => o.isWorking === true)
  @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/, {
    message: 'Format must be HH:mm',
  })
  endTime?: string;

  @IsInt()
  @IsIn([15, 30, 45], {
    message: 'Slot interval must be exactly 15, 30, or 45 minutes',
  })
  slotInterval!: number;

  @IsInt()
  travelTime!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityLocationDto)
  locations!: AvailabilityLocationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakDto)
  breaks!: BreakDto[];
}
