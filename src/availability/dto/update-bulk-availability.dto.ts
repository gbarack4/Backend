import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { UpdateDailyAvailabilityDto } from './update-daily-availability.dto';

export class UpdateBulkAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDailyAvailabilityDto)
  days!: UpdateDailyAvailabilityDto[];
}
