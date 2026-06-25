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

  private suggestDateFormat(countryCode?: string): string {
    if (!countryCode) return 'dd-mm-yyyy';

    if (countryCode === 'US' || countryCode === 'PH') {
      return 'mm-dd-yyyy';
    }

    if (['CN', 'JP', 'KR', 'HU'].includes(countryCode)) {
      return 'yyyy-mm-dd';
    }

    return 'dd-mm-yyyy';
  }

  async getTimezoneByAddress(address: string) {
    const geoRes = await fetch(
      `${GOOGLE_ENDPOINTS.GEOCODING}?address=${encodeURIComponent(address)}&key=${this.apiKey}`,
    );

    const geoData = (await geoRes.json()) as GoogleGeocodeResponse;

    if (geoData.status !== 'OK' || !geoData.results[0]) {
      throw new BadRequestException('Could not resolve location from address');
    }

    const result = geoData.results[0];
    const { lat, lng } = result.geometry.location;

    const country = result.address_components?.find((component) =>
      component.types.includes('country'),
    );

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
      suggestedDateFormat: this.suggestDateFormat(country?.short_name),
    };
  }
}
