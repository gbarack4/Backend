import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentPersonalInfoDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ example: '+1 555 123 4567', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone!: string | null;

  @ApiProperty({ example: '221B Baker Street, London', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address!: string | null;
}
