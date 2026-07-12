import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { UsersService } from '../users/users.service';
import type { RequestWithAuth } from './interfaces/auth.interface';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/database/schema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get('verify-access')
  @UseGuards(ClerkAuthGuard)
  async verifyAppAccess(
    @Req() req: RequestWithAuth,
    @Query('app') app: 'instructor_app' | 'admin_dashboard' | 'student_web',
  ) {
    let userId = req.currentUser?.id;

    if (!userId) {
      const clerkId = req.authPayload?.clerkId;
      if (!clerkId) {
        throw new UnauthorizedException('Auth payload missing');
      }

      const user = await this.usersService.findByClerkId(clerkId);
      if (!user) {
        throw new ForbiddenException('User not found in database');
      }
      userId = user.id;
    }

    let hasAccess = false;
    let activeRole = '';

    switch (app) {
      case 'instructor_app': {
        const instructor = await this.db
          .select({ id: schema.instructors.id })
          .from(schema.instructors)
          .where(eq(schema.instructors.userId, userId))
          .limit(1);

        if (instructor.length > 0) {
          hasAccess = true;
          activeRole = 'instructor';
        }
        break;
      }

      case 'admin_dashboard': {
        const schoolUser = await this.db
          .select({ role: schema.schoolUsers.role })
          .from(schema.schoolUsers)
          .where(eq(schema.schoolUsers.userId, userId))
          .limit(1);

        if (schoolUser.length > 0) {
          hasAccess = true;
          activeRole = schoolUser[0].role;
        }
        break;
      }

      case 'student_web': {
        const student = await this.db
          .select({ id: schema.students.id })
          .from(schema.students)
          .where(eq(schema.students.userId, userId))
          .limit(1);

        if (student.length > 0) {
          hasAccess = true;
          activeRole = 'student';
        }
        break;
      }

      default:
        throw new ForbiddenException('Unknown application requested');
    }

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied. No active profile found for app: ${app}`,
      );
    }

    return {
      hasAccess: true,
      role: activeRole,
    };
  }
}
