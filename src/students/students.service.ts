import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/database/schema';

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async syncStudentWithSchool(clerkUserId: string, schoolId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found. Webhook might be delayed.');
    }

    const [existingStudent] = await this.db
      .select()
      .from(schema.students)
      .where(
        and(
          eq(schema.students.userId, user.id),
          eq(schema.students.schoolId, schoolId),
        ),
      )
      .limit(1);

    if (existingStudent) {
      return existingStudent;
    }

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.email.split('@')[0];

    const [newStudent] = await this.db
      .insert(schema.students)
      .values({
        schoolId,
        userId: user.id,
        name: fullName,
        email: user.email,
        phone: user.phoneNumber,
      })
      .returning();

    return newStudent;
  }
}
