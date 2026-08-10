import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../database/schema';

@Injectable()
export class InstructorSchoolsService {
  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createJoinRequest(userId: string, schoolId: string) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    try {
      const [request] = await this.db
        .insert(schema.instructorSchools)
        .values({
          instructorId: instructor.id,
          schoolId,
          status: 'pending',
          source: 'instructor_request',
        })
        .returning();

      return request;
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === '23505') {
        throw new ConflictException(
          'A request or invite already exists for this school',
        );
      }
      throw error;
    }
  }

  async findSchoolRequests(
    schoolId: string,
    status?: 'pending' | 'accepted' | 'rejected',
  ) {
    const conditions = [
      eq(schema.instructorSchools.schoolId, schoolId),
      eq(schema.instructorSchools.source, 'instructor_request'),
    ];

    if (status) {
      conditions.push(eq(schema.instructorSchools.status, status));
    }

    return this.db
      .select({
        id: schema.instructorSchools.id,
        status: schema.instructorSchools.status,
        createdAt: schema.instructorSchools.createdAt,
        instructor: {
          id: schema.instructors.id,
          name: schema.instructors.name,
          avatarUrl: schema.instructors.avatarUrl,
          yearsOfExperience: schema.instructors.yearsOfExperience,
          documents: schema.instructors.documents,
          transmissionType: schema.instructors.transmissionType,
        },
      })
      .from(schema.instructorSchools)
      .innerJoin(
        schema.instructors,
        eq(schema.instructorSchools.instructorId, schema.instructors.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.instructorSchools.createdAt));
  }

  async updateRequestStatus(id: string, status: 'accepted' | 'rejected') {
    const [updated] = await this.db
      .update(schema.instructorSchools)
      .set({
        status,
        respondedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.instructorSchools.id, id),
          eq(schema.instructorSchools.status, 'pending'),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException(
        'Join request not found or already processed',
      );
    }

    return updated;
  }
}
