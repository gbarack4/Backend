import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentAvatarDto {
  @ApiProperty({
    description:
      'Avatar URL or path — either an absolute URL (uploaded photo) or a relative preset path (e.g. /avatars/presets/avatar-01.svg), or null to remove it',
    nullable: true,
    example: '/avatars/presets/avatar-01.svg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl!: string | null;
}
