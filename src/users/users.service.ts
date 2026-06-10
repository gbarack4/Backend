import { Injectable, Inject } from '@nestjs/common';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/database/schema';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async upsertUser(data: {
    clerkUserId: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
  }) {
    const updateSet = {
      clerkUserId: data.clerkUserId,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      address: data.address,
    };

    const [existing] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1);

    if (existing) {
      return await this.db
        .update(schema.users)
        .set(updateSet)
        .where(eq(schema.users.email, data.email))
        .returning();
    }

    return await this.db
      .insert(schema.users)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        address: data.address,
      })
      .onConflictDoUpdate({
        target: schema.users.clerkUserId,
        set: { email: data.email, ...updateSet },
      })
      .returning();
  }

  async removeUserByClerkId(clerkUserId: string) {
    return await this.db
      .delete(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .returning();
  }

  async findByClerkId(clerkUserId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    return user;
  }
}
