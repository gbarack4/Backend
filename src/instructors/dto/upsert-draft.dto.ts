import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, Min } from 'class-validator';

export class UpsertDraftDto {
  @ApiProperty({ description: 'Current step index the user is on', example: 1 })
  @IsInt()
  @Min(0)
  currentStepIndex!: number;

  @ApiProperty({
    description: 'Raw form data object from frontend',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  formData!: Record<string, any>;
}
