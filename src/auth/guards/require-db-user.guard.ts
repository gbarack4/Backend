import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { RequestWithAuth } from '../interfaces/auth.interface';

@Injectable()
export class RequireDbUserGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (!request.authPayload?.clerkId) {
      throw new UnauthorizedException('Authentication payload is missing');
    }

    const dbUser = await this.usersService.findByClerkId(
      request.authPayload.clerkId,
    );

    if (!dbUser) {
      throw new UnauthorizedException('User profile not found in database');
    }

    request.currentUser = dbUser;

    return true;
  }
}
