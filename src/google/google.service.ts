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

interface GoogleAccountsResponse {
  accounts?: Array<{ name: string }>;
}
interface GoogleLocationsResponse {
  locations?: Array<{ name: string; title: string }>;
}
interface GoogleReviewsResponse {
  reviews?: Array<Record<string, unknown>>;
}

@Injectable()
export class GoogleService {
  private readonly stateSecret: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  private readonly logger = new Logger(GoogleService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    this.callbackUrl = this.configService.getOrThrow<string>(
      'GOOGLE_CALLBACK_URL',
    );
    this.stateSecret = this.configService.getOrThrow<string>(
      'GOOGLE_STATE_SECRET',
    );
  }

  private createOAuthClient(): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, this.callbackUrl);
  }

  private signState(schoolId: string): string {
    const hmac = crypto
      .createHmac('sha256', this.stateSecret)
      .update(schoolId)
      .digest('hex');

    return Buffer.from(`${schoolId}.${hmac}`).toString('base64');
  }

  private verifyAndExtractState(signedState: string): string {
    try {
      const decoded = Buffer.from(signedState, 'base64').toString('utf-8');

      const lastDotIndex = decoded.lastIndexOf('.');
      if (lastDotIndex === -1) throw new Error('Invalid state format');

      const schoolId = decoded.slice(0, lastDotIndex);
      const hash = decoded.slice(lastDotIndex + 1);

      const expectedHash = crypto
        .createHmac('sha256', this.stateSecret)
        .update(schoolId)
        .digest('hex');

      const hashBuf = Buffer.from(hash);
      const expectedBuf = Buffer.from(expectedHash);

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
        this.db
          .update(schema.schools)
          .set({
            googleAccessToken: newTokens.access_token,
            ...(newTokens.refresh_token && {
              googleRefreshToken: newTokens.refresh_token,
            }),
          })
          .where(eq(schema.schools.id, schoolId))
          .catch((err) =>
            this.logger.error('Failed to persist refreshed tokens', err),
          );
      }
    };

    client.on('tokens', onTokens);

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    try {
      return await operation(client);
    } finally {
      client.removeListener('tokens', onTokens);
    }
  }

  getAuthUrl(schoolId: string): string {
    const signedState = this.signState(schoolId);

    return new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.callbackUrl,
    ).generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/business.manage', 'openid'],
      state: signedState,
    });
  }

  async handleCallback(code: string, signedState: string) {
    const schoolId = this.verifyAndExtractState(signedState);
    const client = this.createOAuthClient();

    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new UnauthorizedException('Google did not return an access token');
    }
    if (!tokens.id_token) {
      throw new UnauthorizedException('Missing id_token. Check OAuth scopes.');
    }

    const payload = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
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

    return true;
  }

  async syncGoogleBusinessProfile(schoolId: string) {
    const [school] = await this.db
      .select({
        accessToken: schema.schools.googleAccessToken,
        refreshToken: schema.schools.googleRefreshToken,
      })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId));

    if (!school)
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    if (!school.accessToken) {
      throw new BadRequestException(
        'Google Profile is not connected. Please authorize first.',
      );
    }

    return this.withAuthenticatedClient(
      schoolId,
      school.accessToken,
      school.refreshToken,
      async (client) => {
        const accountsRes = await client.request<GoogleAccountsResponse>({
          url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        });

        const googleAccountName = accountsRes.data.accounts?.[0]?.name;
        if (!googleAccountName)
          throw new BadRequestException('No Google Business accounts found.');

        const locationsRes = await client.request<GoogleLocationsResponse>({
          url: `https://mybusinessbusinessinformation.googleapis.com/v1/${googleAccountName}/locations?readMask=name,title`,
        });

        const googleLocationName = locationsRes.data.locations?.[0]?.name;
        if (!googleLocationName)
          throw new BadRequestException('No locations found.');

        await this.db
          .update(schema.schools)
          .set({
            googleAccountName,
            googleLocationName,
          })
          .where(eq(schema.schools.id, schoolId));

        return { googleAccountName, googleLocationName };
      },
    );
  }

  async getSchoolReviews(schoolId: string) {
    const [school] = await this.db
      .select({
        accessToken: schema.schools.googleAccessToken,
        refreshToken: schema.schools.googleRefreshToken,
        locationName: schema.schools.googleLocationName,
        googleAccountId: schema.schools.googleAccountId,
      })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId));

    if (!school)
      throw new NotFoundException(`School with ID ${schoolId} not found`);

    if (!school.googleAccountId) {
      throw new NotFoundException('Google account not connected');
    }

    if (!school.accessToken || !school.locationName) {
      throw new BadRequestException('Google Business Profile is not synced');
    }

    return this.withAuthenticatedClient(
      schoolId,
      school.accessToken,
      school.refreshToken,
      async (client) => {
        try {
          const reviewsRes = await client.request<GoogleReviewsResponse>({
            url: `https://mybusiness.googleapis.com/v4/${school.locationName}/reviews`,
          });

          return reviewsRes.data.reviews ?? [];
        } catch (err: unknown) {
          let errorDetails: unknown = err;
          if (err !== null && typeof err === 'object' && 'response' in err) {
            const gaxiosError = err as { response?: { data?: unknown } };
            errorDetails = gaxiosError.response?.data ?? err;
          }
          this.logger.error(
            'Failed to fetch Google reviews',
            inspect(errorDetails),
          );
          throw err;
        }
      },
    );
  }
}
