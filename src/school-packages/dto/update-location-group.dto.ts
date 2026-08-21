import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { SuburbDto } from './create-location-group.dto';

export class UpdateLocationGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuburbDto)
  suburbs?: SuburbDto[];
}
