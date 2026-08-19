import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSchoolCoverImageDto {
  @ApiProperty({
    description: 'The secure public URL of the uploaded school cover image',
    example: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
  })
  @IsString()
  @IsNotEmpty({ message: 'Cover image URL is required' })
  coverImageUrl!: string;
}
