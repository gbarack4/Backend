import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithAuth } from '../interfaces/auth.interface';

/**
 * Verifies that the authenticated user belongs to the school identified by
 * the `x-school-id` header, AND that their role *within that school*
 * (school_users.role) satisfies the roles required by @Roles(...).
 *
 * This replaces checking `users.role` (a global, account-level role) for
 * any endpoint scoped to a specific school — a user who owns School A must
 * not be treated as an owner of School B just because their global role
 * happens to be 'owner'.
 *
 * Requires `RequireDbUserGuard` to run first so `request.currentUser` is set.
 */
@Injectable()
export class SchoolRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('DB_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    const schoolId = request.headers['x-school-id'] as string | undefined;
    if (!schoolId) {
      throw new BadRequestException('Header "x-school-id" is required');
    }

    const userId = request.currentUser?.id;
    if (!userId) {
      throw new ForbiddenException('User profile not found');
    }

    const [membership] = await this.db
      .select({ role: schema.schoolUsers.role })
      .from(schema.schoolUsers)
      .where(
        and(
          eq(schema.schoolUsers.userId, userId),
          eq(schema.schoolUsers.schoolId, schoolId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You do not have access to this school');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator on this route — membership alone is enough.
    if (!requiredRoles) {
      return true;
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Access denied. Required roles in this school: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
