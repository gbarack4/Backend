import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { UsersService } from '../users/users.service';
import type { RequestWithAuth } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Get('verify-access')
  @UseGuards(ClerkAuthGuard)
  async verifyAppAccess(
    @Req() req: RequestWithAuth,
    @Query('app') app: 'instructor_app' | 'admin_dashboard' | 'student_web',
  ) {
    let userRole = req.currentUser?.role;

    if (!userRole) {
      const clerkId = req.authPayload?.clerkId;
      if (!clerkId) {
        throw new UnauthorizedException('Auth payload missing');
      }

      const user = await this.usersService.findByClerkId(clerkId);
      if (!user) {
        throw new ForbiddenException('User not found in database');
      }
      userRole = user.role;
    }

    const accessMap: Record<string, string[]> = {
      instructor_app: ['instructor'],
      admin_dashboard: ['owner'],
      student_web: ['student'],
    };

    const allowedRoles = accessMap[app];

    if (!allowedRoles) {
      throw new ForbiddenException('Unknown application');
    }

    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Access denied for role: ${userRole} to app: ${app}`,
      );
    }

    return {
      hasAccess: true,
      role: userRole,
    };
  }
}
