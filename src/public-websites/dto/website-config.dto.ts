import { ApiProperty } from '@nestjs/swagger';

export class WebsiteConfigDto {
  @ApiProperty({
    description: 'The unique identifier of the driving school',
    example: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
  })
  schoolId!: string;

  @ApiProperty({
    description: 'The formal name of the driving school',
    example: 'Drive Master',
  })
  schoolName!: string;

  @ApiProperty({
    description: 'The identifier of the active visual template',
    example: 'modern-dark',
  })
  templateName!: string;

  @ApiProperty({
    description: 'Arbitrary configuration parameters for the template',
    example: { primaryColor: '#ff0000', showHero: true },
    type: 'object',
    additionalProperties: true,
  })
  config!: Record<string, any>;
}
