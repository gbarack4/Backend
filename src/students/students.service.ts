import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
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

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.email.split('@')[0];

    return this.upsertStudent({
      userId: user.id,
      schoolId,
      name: fullName,
      email: user.email,
      phone: user.phoneNumber,
    });
  }

  async upsertStudent(
    data: {
      userId: string;
      schoolId: string;
      name: string;
      email?: string | null;
      phone?: string | null;
    },
    tx: NodePgDatabase<typeof schema> = this.db,
  ) {
    const [student] = await tx
      .insert(schema.students)
      .values({
        userId: data.userId,
        schoolId: data.schoolId,
        name: data.name,
        email: data.email,
        phone: data.phone,
      })
      .onConflictDoUpdate({
        target: [schema.students.schoolId, schema.students.userId],
        set: {
          name: data.name,
          email: data.email,
          phone: data.phone,
        },
      })
      .returning();

    return student;
  }

  async getStudentByUserIdAndSchool(userId: string, schoolId: string) {
    const [student] = await this.db
      .select({
        id: schema.students.id,
        schoolId: schema.students.schoolId,
        name: schema.students.name,
        email: schema.students.email,
        phone: schema.students.phone,
        createdAt: schema.students.createdAt,
        user: {
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          phoneNumber: schema.users.phoneNumber,
          avatarUrl: schema.users.avatarUrl,
          address: schema.users.address,
        },
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(
        and(
          eq(schema.students.userId, userId),
          eq(schema.students.schoolId, schoolId),
        ),
      )
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student record not found for this school');
    }

    return student;
  }
}
