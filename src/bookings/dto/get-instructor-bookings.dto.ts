import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GetInstructorBookingsDto {
  @IsOptional()
  @IsIn(['upcoming', 'completed', 'cancelled'])
  status?: 'upcoming' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
