import { Module } from '@nestjs/common';
import { PublicWebsitesController } from './public-websites.controller';
import { PublicWebsitesService } from './public-websites.service';

@Module({
  controllers: [PublicWebsitesController],
  providers: [PublicWebsitesService],
})
export class PublicWebsitesModule {}
