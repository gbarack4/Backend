import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchSchoolsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originLng?: number;

  @IsOptional()
  @IsNumber()
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset: number = 0;
}
