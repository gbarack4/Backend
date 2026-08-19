import { verifyToken } from '@clerk/clerk-sdk-node';
import type { JwtPayload } from '@clerk/types';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import clerkConfig from '../config/clerk.config';

@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);

  constructor(
    @Inject(clerkConfig.KEY)
    private readonly config: ConfigType<typeof clerkConfig>,
  ) {}

  async verify(token: string): Promise<JwtPayload> {
    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.secretKey,
        issuer: this.config.issuer,
      });

      if (!payload.sub) {
        throw new Error('Token does not contain a subject (sub)');
      }

      return payload;
    } catch (error) {
      this.logger.error(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
