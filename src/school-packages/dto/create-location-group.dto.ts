import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SuburbDto {
  @IsString()
  suburb!: string;

  @IsOptional()
  @IsString()
  postcode?: string;
}

export class CreateLocationGroupDto {
  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuburbDto)
  suburbs!: SuburbDto[];
}
