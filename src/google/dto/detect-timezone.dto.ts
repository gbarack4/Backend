import { IsString, IsNotEmpty } from 'class-validator';

export class DetectTimezoneDto {
  @IsString()
  @IsNotEmpty()
  address!: string;
}
