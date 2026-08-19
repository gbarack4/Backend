import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DetectTimezoneDto {
  @ApiProperty({
    description: 'The full physical address used to detect the timezone',
    example: '1600 Amphitheatre Parkway, Mountain View, CA',
  })
  @IsString()
  @IsNotEmpty()
  address!: string;
}
