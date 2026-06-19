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
  @IsString()
  @MinLength(2, { message: 'School name must be at least 2 characters' })
  name!: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @MinLength(7, { message: 'Phone number must be at least 7 characters' })
  phone!: string;

  @IsString()
  @IsIn(BUSINESS_CATEGORIES, { message: 'Invalid business category selected' })
  category!: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description!: string;

  @IsString()
  @IsNotEmpty({ message: 'Address Line 1 is required' })
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty({ message: 'Suburb is required' })
  suburb!: string;

  @IsString()
  @IsIn(AUSTRALIAN_STATES, { message: 'Invalid state selected' })
  state!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Postcode must be exactly 4 digits' })
  postcode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Timezone is required' })
  timezone!: string;

  @IsString()
  @IsIn(DATE_FORMAT_OPTIONS, { message: 'Invalid date format' })
  dateFormat!: string;

  @IsString()
  @IsIn(TIME_FORMAT_OPTIONS, { message: 'Invalid time format' })
  timeFormat!: string;

  @IsString()
  @IsIn(['onboarding', 'active', 'suspended'], {
    message: 'Status must be either active or closed',
  })
  status!: string;
}
