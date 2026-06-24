import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsIn,
  Matches,
} from 'class-validator';

import {
  BUSINESS_CATEGORIES,
  AUSTRALIAN_STATES,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from '../constants/school.constants';

export class BaseSchoolDto {
  @ApiProperty({
    description:
      'The registered legal or commercial name of the driving school',
    example: 'Apex Driving Academy',
    minLength: 2,
  })
  @IsString()
  @MinLength(2, { message: 'School name must be at least 2 characters' })
  name!: string;

  @ApiProperty({
    description: 'Primary contact email address for the school',
    example: 'info@apexdriving.com.au',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({
    description: 'Contact phone number (must be at least 7 characters)',
    example: '+61412345678',
    minLength: 7,
  })
  @IsString()
  @MinLength(7, { message: 'Phone number must be at least 7 characters' })
  phone!: string;

  @ApiProperty({
    description: 'The primary business focus category',
    enum: BUSINESS_CATEGORIES,
    example: 'Driving School',
  })
  @IsString()
  @IsIn(BUSINESS_CATEGORIES, { message: 'Invalid business category selected' })
  category!: string;

  @ApiProperty({
    description:
      'Detailed public description of the school, its mission, or services',
    example:
      'Providing premium, high-quality automatic and manual driving lessons across Brisbane.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description!: string;

  @ApiProperty({
    description: 'Street address line 1 (e.g., house number, street name)',
    example: '123 Main Street',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address Line 1 is required' })
  addressLine1!: string;

  @ApiPropertyOptional({
    description: 'Street address line 2 (e.g., suite, unit, shop number)',
    example: 'Suite 4B',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({
    description: 'City, suburb, or locality name',
    example: 'Brisbane',
  })
  @IsString()
  @IsNotEmpty({ message: 'Suburb is required' })
  suburb!: string;

  @ApiProperty({
    description: 'Australian State/Territory code',
    enum: AUSTRALIAN_STATES,
    example: 'QLD',
  })
  @IsString()
  @IsIn(AUSTRALIAN_STATES, { message: 'Invalid state selected' })
  state!: string;

  @ApiProperty({
    description: 'Australian 4-digit postcode matching the physical location',
    example: '4000',
    pattern: String.raw`^\d{4}$`,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Postcode must be exactly 4 digits' })
  postcode!: string;

  @ApiProperty({
    description:
      'The operational timezone ID according to IANA timezone database standard',
    example: 'Australia/Brisbane',
  })
  @IsString()
  @IsNotEmpty({ message: 'Timezone is required' })
  timezone!: string;

  @ApiProperty({
    description: 'Preferred presentation format for calendar and system dates',
    enum: DATE_FORMAT_OPTIONS,
    example: 'dd/MM/yyyy',
  })
  @IsString()
  @IsIn(DATE_FORMAT_OPTIONS, { message: 'Invalid date format' })
  dateFormat!: string;

  @ApiProperty({
    description: 'Preferred system display format for daily time markers',
    enum: TIME_FORMAT_OPTIONS,
    example: 'hh:mm a',
  })
  @IsString()
  @IsIn(TIME_FORMAT_OPTIONS, { message: 'Invalid time format' })
  timeFormat!: string;

  @ApiProperty({
    description:
      'Current operational state workflow status of the school system entity',
    enum: ['onboarding', 'active', 'suspended'],
    example: 'active',
  })
  @IsString()
  @IsIn(['onboarding', 'active', 'suspended'], {
    message: 'Status must be either active or closed',
  })
  status!: string;
}
