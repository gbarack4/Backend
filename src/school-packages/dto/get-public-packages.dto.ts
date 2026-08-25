import { IsNotEmpty, IsString } from 'class-validator';

export class GetPublicPackagesDto {
  @IsString()
  @IsNotEmpty()
  suburb!: string;
}
