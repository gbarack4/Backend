import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import {
  PublicWebsitesService,
  WebsiteConfigDto,
} from './public-websites.service';

@Controller('public/websites')
export class PublicWebsitesController {
  constructor(private readonly websitesService: PublicWebsitesService) {}

  @Get(':domain')
  async getWebsiteConfig(
    @Param('domain') domain: string,
  ): Promise<WebsiteConfigDto> {
    const config: WebsiteConfigDto | null =
      await this.websitesService.findByDomain(domain);

    if (!config) {
      throw new NotFoundException(`Website with domain '${domain}' not found`);
    }

    return config;
  }
}
