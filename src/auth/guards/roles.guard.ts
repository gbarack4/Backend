import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithAuth } from '../interfaces/auth.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.currentUser;

    if (!user) {
      throw new ForbiddenException('User profile not found');
    }

    const hasAccess = await this.checkUserRoles(requiredRoles, user.id, request);

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied. You do not have the required profile for roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }

  private async checkUserRoles(
    roles: string[],
    userId: string,
    request: RequestWithAuth,
  ): Promise<boolean> {
    for (const role of roles) {
      if (role === 'instructor' && (await this.isInstructor(userId, request))) return true;
      if (role === 'student' && (await this.isStudent(userId))) return true;
      if (['owner', 'admin', 'staff'].includes(role) && (await this.isStaff(userId))) return true;
    }
    return false;
  }

  private async isInstructor(userId: string, request: RequestWithAuth): Promise<boolean> {
    const record = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId))
      .limit(1);

    if (record.length > 0) {
      request.instructorId = record[0].id;
      return true;
    }
    return false;
  }

  private async isStudent(userId: string): Promise<boolean> {
    const record = await this.db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .limit(1);

    return record.length > 0;
  }

  private async isStaff(userId: string): Promise<boolean> {
    const record = await this.db
      .select({ id: schema.schoolUsers.id })
      .from(schema.schoolUsers)
      .where(eq(schema.schoolUsers.userId, userId))
      .limit(1);

    return record.length > 0;
  }
}
