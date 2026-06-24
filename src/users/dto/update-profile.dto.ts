import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the user',
    example: '+61412345678',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Physical or mailing address',
    example: '123 Main Street, Brisbane QLD 4000',
  })
  @IsString()
  @IsOptional()
  address?: string;
}
