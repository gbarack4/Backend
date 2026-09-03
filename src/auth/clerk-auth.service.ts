import { type ClerkClient, createClerkClient, type User, verifyToken } from '@clerk/backend';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import clerkConfig from '@/config/clerk.config';

@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);

  private readonly clerkClient: ClerkClient;

  constructor(
    @Inject(clerkConfig.KEY)
    private readonly config: ConfigType<typeof clerkConfig>,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.secretKey,
    });
  }

  getUser(clerkUserId: string): Promise<User> {
    return this.clerkClient.users.getUser(clerkUserId);
  }

  async verify(token: string) {
    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.secretKey,
      });

      if (!payload.sub) {
        throw new Error('Token does not contain a subject (sub)');
      }

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown verification error';

      this.logger.error(`Token verification failed: ${message}`);

      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
