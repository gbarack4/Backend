import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSchoolLogoDto {
  @ApiProperty({
    description: 'The secure public URL of the uploaded school logo image',
    example: 'https://storage.drivinginstructor.pro/logos/school-123.png',
  })
  @IsString()
  @IsNotEmpty()
  logoUrl!: string;
}
