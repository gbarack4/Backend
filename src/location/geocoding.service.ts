import { Injectable, Logger } from '@nestjs/common';

import { NominatimResponse } from './interfaces/geocoding.interface';
import { GeocodeResult } from './types/geocoding.types';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  private readonly USER_AGENT = 'DrivingSchoolSaaS/1.0 (admin@driveinstructor.pro)';
  private readonly GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
  private readonly REQUEST_TIMEOUT_MS = 5000;
  private readonly THROTTLE_DELAY_MS = 1100;

  private requestQueue: Promise<void> = Promise.resolve();

  async getCoordinatesFromAddress(
    addressStr: string,
    countryCode?: string,
  ): Promise<GeocodeResult> {
    return new Promise((resolve) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          const result = await this.performRequest(addressStr, countryCode);
          resolve(result);
          await new Promise((res) => setTimeout(res, this.THROTTLE_DELAY_MS));
        })
        .catch(() => {
          resolve({ status: 'error', message: 'Internal queue error' });
        });
    });
  }

  private async performRequest(addressStr: string, countryCode?: string): Promise<GeocodeResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const url = new URL(this.GEOCODE_URL);
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', addressStr);
      url.searchParams.set('limit', '1');

      if (countryCode) {
        url.searchParams.set('countrycodes', countryCode.toLowerCase());
      }

      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(`Geocoding API failed with status: ${response.status}`);
        return {
          status: 'error',
          message: `Nominatim API returned ${response.status}`,
        };
      }

      const data = (await response.json()) as NominatimResponse[];

      if (Array.isArray(data) && data.length > 0 && data[0]) {
        const lat = Number.parseFloat(data[0].lat);
        const lng = Number.parseFloat(data[0].lon);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          this.logger.warn(`API returned invalid coordinates for: ${addressStr}`);
          return { status: 'error', message: 'Invalid coordinates returned' };
        }

        return { status: 'found', lat, lng };
      }

      this.logger.log(`No coordinates found for address: ${addressStr}`);
      return { status: 'not_found' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`Geocoding request timed out for: ${addressStr}`);
        return { status: 'error', message: 'Request timed out' };
      }

      const errMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Geocoding request failed: ${errMessage}`);
      return { status: 'error', message: errMessage };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
