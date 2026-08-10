import { IsUUID } from 'class-validator';

export class CreateInviteDto {
  @IsUUID('4')
  instructorId!: string;
}
