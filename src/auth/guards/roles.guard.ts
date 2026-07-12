import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithAuth } from '../interfaces/auth.interface';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/database/schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.currentUser;

    if (!user) {
      throw new ForbiddenException('User profile not found');
    }

    let hasAccess = false;

    for (const role of requiredRoles) {
      if (role === 'instructor') {
        const instructorRecord = await this.db
          .select({ id: schema.instructors.id })
          .from(schema.instructors)
          .where(eq(schema.instructors.userId, user.id))
          .limit(1);

        if (instructorRecord.length > 0) {
          hasAccess = true;
          request.instructorId = instructorRecord[0].id;
          break;
        }
      }

      if (role === 'student') {
        const studentRecord = await this.db
          .select({ id: schema.students.id })
          .from(schema.students)
          .where(eq(schema.students.userId, user.id))
          .limit(1);

        if (studentRecord.length > 0) {
          hasAccess = true;
          break;
        }
      }

      if (['owner', 'admin', 'staff'].includes(role)) {
        const schoolUserRecord = await this.db
          .select({ id: schema.schoolUsers.id })
          .from(schema.schoolUsers)
          .where(eq(schema.schoolUsers.userId, user.id))
          .limit(1);

        if (schoolUserRecord.length > 0) {
          hasAccess = true;
          break;
        }
      }
    }

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied. You do not have the required profile for roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
