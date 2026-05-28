import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { JwtPayload } from '@clerk/types';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    try {
      const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      const issuer = this.configService.get<string>('CLERK_ISSUER');

      if (!secretKey || !issuer) {
        throw new Error('CLERK_SECRET_KEY or CLERK_ISSUER is not configured');
      }

      const payload = await verifyToken(token, { secretKey, issuer });

      request.user = payload;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('JWT Verification failed', error.stack);
      } else {
        this.logger.error(`JWT Verification failed: ${JSON.stringify(error)}`);
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
