import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { WebsiteConfigDto } from './dto/website-config.dto';
import { PublicWebsitesService } from './public-websites.service';

@ApiTags('public-websites')
@Controller('public/websites')
export class PublicWebsitesController {
  constructor(private readonly websitesService: PublicWebsitesService) {}

  @Get(':domain')
  @ApiOperation({ summary: 'Get website configuration by domain' })
  @ApiParam({
    name: 'domain',
    description: 'The unique domain of the driving school',
    example: 'fast-fury-25.localhost:3002',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the website configuration and active template settings.',
    type: WebsiteConfigDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Website with the given domain was not found.',
  })
  async getWebsiteConfig(@Param('domain') domain: string): Promise<WebsiteConfigDto> {
    const config: WebsiteConfigDto | null = await this.websitesService.findByDomain(domain);

    if (!config) {
      throw new NotFoundException(`Website with domain '${domain}' not found`);
    }

    return config;
  }
}
