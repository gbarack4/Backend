import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkAuthService } from '../clerk-auth.service';
import { RequestWithAuth } from '../interfaces/auth.interface';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly clerkAuthService: ClerkAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    const payload = await this.clerkAuthService.verify(token);

    request.authPayload = { clerkId: payload.sub };

    return true;
  }

  private extractTokenFromHeader(request: RequestWithAuth): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
