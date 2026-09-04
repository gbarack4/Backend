import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GetStudentBookingsDto {
  @IsOptional()
  @IsIn(['upcoming', 'completed', 'cancelled'])
  status?: 'upcoming' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
