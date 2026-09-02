import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchSchoolInstructorsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  query!: string;
}
