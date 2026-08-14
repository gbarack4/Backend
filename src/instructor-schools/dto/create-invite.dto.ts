import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  message?: string;
}
