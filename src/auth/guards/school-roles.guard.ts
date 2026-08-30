import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithAuth } from '../interfaces/auth.interface';

@Injectable()
export class SchoolRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    const schoolId =
      (request.headers['x-school-id'] as string) ||
      (request.params?.schoolId as string) ||
      (request.query?.schoolId as string);

    if (!schoolId) {
      throw new BadRequestException('schoolId (header, param, or query) is required');
    }

    const userId = request.currentUser?.id;
    if (!userId) {
      throw new ForbiddenException('User profile not found');
    }

    const [membership] = await this.db
      .select({
        role: schema.schoolUsers.role,
        permission: schema.schoolUsers.permission,
      })
      .from(schema.schoolUsers)
      .where(and(eq(schema.schoolUsers.userId, userId), eq(schema.schoolUsers.schoolId, schoolId)))
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You do not have access to this school');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Access denied. Required roles in this school: ${requiredRoles.join(', ')}`,
      );
    }

    const requiredPermission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPermission) {
      const hasPermission =
        membership.role === 'owner' || membership.permission === requiredPermission;

      if (!hasPermission) {
        throw new ForbiddenException(
          `Access denied. This action requires '${requiredPermission}' permission.`,
        );
      }
    }

    return true;
  }
}
