import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSchoolCoverImageDto {
  @IsString()
  @IsNotEmpty({ message: 'Cover image URL is required' })
  coverImageUrl!: string;
}
