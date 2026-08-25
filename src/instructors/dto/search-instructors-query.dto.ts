import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SearchInstructorsQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'suburb must not be empty',
  })
  @MaxLength(100)
  suburb!: string;

  @IsOptional()
  @IsIn(['manual', 'automatic'])
  transmission?: 'manual' | 'automatic';

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'preferredDate must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    {
      message: 'preferredDate must be a valid date',
    },
  )
  preferredDate!: string;
}
