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

  async upsertUser(data: { clerkUserId: string; email: string; role: string }) {
    return await this.db
      .insert(schema.users)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        role: data.role,
      })
      .onConflictDoUpdate({
        target: schema.users.clerkUserId,
        set: {
          email: data.email,
          role: data.role,
        },
      })
      .returning();
  }

  async removeUserByClerkId(clerkUserId: string) {
    return await this.db
      .delete(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .returning();
  }
}
