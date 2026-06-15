import {
  Injectable,
  Inject,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { inspect } from 'node:util';
import * as schema from '@/database/schema';

const GOOGLE_ENDPOINTS = {
  ACCOUNTS: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  LOCATIONS: (accountName: string) =>
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
  REVIEWS: (locationName: string) =>
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
} as const;

interface GoogleAccount {
  name: string;
}

interface GoogleAccountsResponse {
  accounts?: GoogleAccount[];
}

interface GoogleLocationsResponse {
  locations?: Array<{ name: string; title: string }>;
}

interface GoogleReviewsResponse {
  reviews?: Array<Record<string, unknown>>;
}

export interface GoogleLocation {
  id: string;
  title: string;
  accountName: string;
}

export type SchoolGoogleData = {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  locationName: string | null;
  googleAccountId: string | null;
};

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  private readonly googleConfig: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    stateSecret: string;
  };

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.googleConfig = {
      clientId: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow<string>(
        'GOOGLE_CLIENT_SECRET',
      ),
      callbackUrl: this.configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      stateSecret: this.configService.getOrThrow<string>('GOOGLE_STATE_SECRET'),
    };
  }

  private logGoogleError(message: string, error: unknown): void {
    let errorDetails: unknown = error;
    if (error !== null && typeof error === 'object' && 'response' in error) {
      const gaxiosError = error as { response?: { data?: unknown } };
      errorDetails = gaxiosError.response?.data ?? error;
    }
    this.logger.error(message, inspect(errorDetails));
  }

  private async getSchoolGoogleData(
    schoolId: string,
  ): Promise<SchoolGoogleData> {
    const [school] = await this.db
      .select({
        id: schema.schools.id,
        accessToken: schema.schools.googleAccessToken,
        refreshToken: schema.schools.googleRefreshToken,
        locationName: schema.schools.googleLocationName,
        googleAccountId: schema.schools.googleAccountId,
      })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId));

    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }
    return school;
  }

  private createOAuthClient(): OAuth2Client {
    return new OAuth2Client(
      this.googleConfig.clientId,
      this.googleConfig.clientSecret,
      this.googleConfig.callbackUrl,
    );
  }

  private signState(schoolId: string): string {
    const hmac = crypto
      .createHmac('sha256', this.googleConfig.stateSecret)
      .update(schoolId)
      .digest('hex');

    return Buffer.from(`${schoolId}.${hmac}`).toString('base64url');
  }

  private verifyAndExtractState(signedState: string): string {
    try {
      const decoded = Buffer.from(signedState, 'base64url').toString('utf-8');

      const lastDotIndex = decoded.lastIndexOf('.');
      if (lastDotIndex === -1) throw new Error('Invalid state format');

      const schoolId = decoded.slice(0, lastDotIndex);
      const hash = decoded.slice(lastDotIndex + 1);

      const expectedHash = crypto
        .createHmac('sha256', this.googleConfig.stateSecret)
        .update(schoolId)
        .digest('hex');

      const hashBuf = Buffer.from(hash, 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');

      if (
        hashBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(hashBuf, expectedBuf)
      ) {
        throw new Error('State hash mismatch');
      }

      return schoolId;
    } catch (err) {
      throw new UnauthorizedException('Invalid or tampered state parameter', {
        cause: err,
      });
    }
  }

  private async withAuthenticatedClient<T>(
    schoolId: string,
    accessToken: string,
    refreshToken: string | null,
    operation: (client: OAuth2Client) => Promise<T>,
  ): Promise<T> {
    const client = this.createOAuthClient();

    const onTokens = (newTokens: Credentials) => {
      if (newTokens.access_token) {
        void this.db
          .update(schema.schools)
          .set({
            googleAccessToken: newTokens.access_token,
            ...(newTokens.refresh_token && {
              googleRefreshToken: newTokens.refresh_token,
            }),
          })
          .where(eq(schema.schools.id, schoolId))
          .catch((err: unknown) => {
            this.logger.error(
              'Failed to persist refreshed tokens',
              inspect(err),
            );
          });
      }
    };

    client.on('tokens', onTokens);

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    try {
      return await operation(client);
    } catch (error) {
      this.logGoogleError(
        `Google API Operation Failed for School ${schoolId}`,
        error,
      );
      throw error;
    } finally {
      client.removeListener('tokens', onTokens);
    }
  }

  getAuthUrl(schoolId: string): string {
    const signedState = this.signState(schoolId);

    const client = this.createOAuthClient();

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/business.manage',
        'openid',
        'email',
        'profile',
      ],
      state: signedState,
    });
  }

  async handleCallback(code: string, signedState: string): Promise<void> {
    const schoolId = this.verifyAndExtractState(signedState);
    const client = this.createOAuthClient();

    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new UnauthorizedException('Google did not return an access token');
    }

    if (!tokens.refresh_token) {
      this.logger.warn(
        `Refresh token missing for school ${schoolId}. User might need to re-consent if token expires.`,
      );
    }

    if (!tokens.id_token) {
      throw new UnauthorizedException('Missing id_token. Check OAuth scopes.');
    }

    const payload = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.googleConfig.clientId,
    });

    const googleAccountId = payload.getUserId();

    const [updatedSchool] = await this.db
      .update(schema.schools)
      .set({
        googleAccessToken: tokens.access_token,
        googleAccountId,
        ...(tokens.refresh_token && {
          googleRefreshToken: tokens.refresh_token,
        }),
      })
      .where(eq(schema.schools.id, schoolId))
      .returning({ id: schema.schools.id });

    if (!updatedSchool) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }
  }

  async fetchAvailableLocations(schoolId: string): Promise<GoogleLocation[]> {
    const school = await this.getSchoolGoogleData(schoolId);

    if (!school.accessToken) {
      throw new BadRequestException('Google Profile is not connected.');
    }

    return this.withAuthenticatedClient(
      schoolId,
      school.accessToken,
      school.refreshToken,
      async (client) => {
        const accountsRes = await client.request<GoogleAccountsResponse>({
          url: GOOGLE_ENDPOINTS.ACCOUNTS,
        });

        const accounts = accountsRes.data.accounts;
        if (!accounts || accounts.length === 0) {
          throw new BadRequestException('No Google Business accounts found.');
        }

        const allLocations: GoogleLocation[] = [];

        const locationPromises = accounts.map((account) =>
          client
            .request<GoogleLocationsResponse>({
              url: GOOGLE_ENDPOINTS.LOCATIONS(account.name),
            })
            .then((res) => ({
              success: true as const,
              accountName: account.name,
              data: res.data,
            }))
            .catch((error: unknown) => ({
              success: false as const,
              accountName: account.name,
              error,
            })),
        );

        const results = await Promise.all(locationPromises);

        for (const result of results) {
          if (result.success && result.data.locations) {
            allLocations.push(
              ...result.data.locations.map((loc) => ({
                id: loc.name,
                title: loc.title,
                accountName: result.accountName,
              })),
            );
          } else if (!result.success) {
            this.logger.warn(
              `Failed to fetch locations for account: ${result.accountName}`,
              inspect(result.error),
            );
          }
        }
        return allLocations;
      },
    );
  }

  async setBusinessLocation(
    schoolId: string,
    locationName: string,
    accountName: string,
  ): Promise<void> {
    const availableLocations = await this.fetchAvailableLocations(schoolId);
    const isValid = availableLocations.some(
      (loc) => loc.id === locationName && loc.accountName === accountName,
    );

    if (!isValid) {
      throw new BadRequestException(
        'Invalid location or account provided, or you do not have access to it.',
      );
    }

    const [updated] = await this.db
      .update(schema.schools)
      .set({
        googleLocationName: locationName,
        googleAccountName: accountName,
      })
      .where(eq(schema.schools.id, schoolId))
      .returning({ id: schema.schools.id });

    if (!updated) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }
  }

  async getSchoolReviews(schoolId: string) {
    const school = await this.getSchoolGoogleData(schoolId);

    if (!school.accessToken) {
      throw new NotFoundException('Google account not connected');
    }

    if (!school.locationName) {
      throw new BadRequestException(
        'Google Business Profile location is not selected',
      );
    }

    return this.withAuthenticatedClient(
      schoolId,
      school.accessToken,
      school.refreshToken,
      async (client) => {
        const reviewsRes = await client.request<GoogleReviewsResponse>({
          url: GOOGLE_ENDPOINTS.REVIEWS(school.locationName!),
        });

        return reviewsRes.data.reviews ?? [];
      },
    );
  }
}
