import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GOOGLE_ENDPOINTS } from './constants/google.endpoints';
import {
  GoogleGeocodeResponse,
  GoogleTimezoneResponse,
} from './types/google.types';

@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>(
      'GOOGLE_TIMEZONE_API_KEY',
    );
  }

  async getTimezoneByAddress(address: string) {
    const geoRes = await fetch(
      `${GOOGLE_ENDPOINTS.GEOCODING}?address=${encodeURIComponent(address)}&key=${this.apiKey}`,
    );

    const geoData = (await geoRes.json()) as GoogleGeocodeResponse;

    if (geoData.status !== 'OK' || !geoData.results[0]) {
      throw new BadRequestException('Could not resolve location from address');
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    const timestamp = Math.floor(Date.now() / 1000);
    const tzRes = await fetch(
      `${GOOGLE_ENDPOINTS.TIMEZONE}?location=${lat},${lng}&timestamp=${timestamp}&key=${this.apiKey}`,
    );

    const tzData = (await tzRes.json()) as GoogleTimezoneResponse;

    if (tzData.status !== 'OK') {
      throw new BadRequestException('Could not detect timezone');
    }

    return {
      timeZoneId: tzData.timeZoneId,
      suggestedDateFormat: 'dd-mm-yyyy',
    };
  }
}
