import { IsUUID } from 'class-validator';

export class CreateJoinRequestDto {
  @IsUUID()
  schoolId!: string;
}
