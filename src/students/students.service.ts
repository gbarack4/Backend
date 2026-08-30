import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { ClerkAuthService } from '@/auth/clerk-auth.service';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async syncStudentWithSchool(clerkUserId: string, schoolId: string) {
    let [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    if (!user) {
      const clerkUser = await this.clerkAuthService.getUser(clerkUserId);

      const primaryEmail =
        clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!primaryEmail) {
        throw new NotFoundException('Clerk user email not found');
      }

      const unsafeMetadata = clerkUser.unsafeMetadata as {
        phone_number?: string;
      };

      const phoneNumber =
        typeof unsafeMetadata.phone_number === 'string' ? unsafeMetadata.phone_number : undefined;

      [user] = await this.db
        .insert(schema.users)
        .values({
          clerkUserId,
          email: primaryEmail,
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
          avatarUrl: clerkUser.imageUrl ?? undefined,
          phoneNumber,
        })
        .onConflictDoUpdate({
          target: schema.users.clerkUserId,
          set: {
            email: primaryEmail,
            firstName: clerkUser.firstName ?? undefined,
            lastName: clerkUser.lastName ?? undefined,
            phoneNumber,
          },
        })
        .returning();
    }

    if (!user) {
      throw new NotFoundException('Failed to create user');
    }

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

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
      avatarUrl?: string | null;
    },
    tx: NodePgDatabase<FullSchema> = this.db,
  ) {
    const [student] = await tx
      .insert(schema.students)
      .values({
        userId: data.userId,
        schoolId: data.schoolId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
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

  async updateAvatarUrl(userId: string, schoolId: string, avatarUrl: string | null) {
    const [student] = await this.db
      .update(schema.students)
      .set({ avatarUrl })
      .where(and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)))
      .returning();

    if (!student) {
      throw new NotFoundException('Student record not found for this school');
    }

    return student;
  }

  async updatePersonalInfo(
    userId: string,
    schoolId: string,
    data: {
      fullName: string;
      phone: string | null;
      address: string | null;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [student] = await tx
        .update(schema.students)
        .set({
          name: data.fullName,
          phone: data.phone,
        })
        .where(and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)))
        .returning();

      if (!student) {
        throw new NotFoundException('Student record not found for this school');
      }

      await tx
        .update(schema.users)
        .set({ address: data.address })
        .where(eq(schema.users.id, userId));

      return this.getStudentByUserIdAndSchool(userId, schoolId, tx);
    });
  }

  async getStudentByUserIdAndSchool(
    userId: string,
    schoolId: string,
    tx: NodePgDatabase<FullSchema> = this.db,
  ) {
    const [student] = await tx
      .select({
        id: schema.students.id,
        schoolId: schema.students.schoolId,
        name: schema.students.name,
        email: schema.students.email,
        phone: schema.students.phone,
        avatarUrl: schema.students.avatarUrl,
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
      .where(and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student record not found for this school');
    }

    return student;
  }
}
