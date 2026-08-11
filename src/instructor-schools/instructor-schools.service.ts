import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../database/schema';
import { SuprSendService } from '@/suprsend/suprsend.service';

@Injectable()
export class InstructorSchoolsService {
  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase<typeof schema>,
    private readonly suprSendService: SuprSendService,
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
    status?: 'pending' | 'accepted' | 'rejected' | 'paused',
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

  async createSchoolInvite(schoolId: string, instructorId: string) {
    try {
      const [invite] = await this.db
        .insert(schema.instructorSchools)
        .values({
          instructorId,
          schoolId,
          status: 'pending',
          source: 'school_invite',
        })
        .returning();

      const [instructorData] = await this.db
        .select({
          userId: schema.instructors.userId,
          email: schema.users.email,
        })
        .from(schema.instructors)
        .innerJoin(schema.users, eq(schema.instructors.userId, schema.users.id))
        .where(eq(schema.instructors.id, instructorId));

      const [schoolData] = await this.db
        .select({ name: schema.schools.name })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId));

      if (instructorData && schoolData) {
        await this.suprSendService.sendSchoolInviteNotification({
          recipientUserId: instructorData.userId,
          recipientEmail: instructorData.email,
          schoolName: schoolData.name,
          inviteId: invite.id,
        });
      }

      return invite;
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === '23505') {
        throw new ConflictException(
          'A request or invite already exists for this instructor',
        );
      }
      throw error;
    }
  }

  async findInstructorInvites(userId: string) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    return this.db
      .select({
        id: schema.instructorSchools.id,
        status: schema.instructorSchools.status,
        createdAt: schema.instructorSchools.createdAt,
        school: {
          id: schema.schools.id,
          name: schema.schools.name,
          logoUrl: schema.schools.logoUrl,
          slug: schema.schools.slug,
        },
      })
      .from(schema.instructorSchools)
      .innerJoin(
        schema.schools,
        eq(schema.instructorSchools.schoolId, schema.schools.id),
      )
      .where(
        and(
          eq(schema.instructorSchools.instructorId, instructor.id),
          eq(schema.instructorSchools.source, 'school_invite'),
          eq(schema.instructorSchools.status, 'pending'),
        ),
      );
  }

  async respondToInvite(
    userId: string,
    inviteId: string,
    status: 'accepted' | 'rejected',
  ) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    const [updated] = await this.db
      .update(schema.instructorSchools)
      .set({
        status,
        respondedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.instructorSchools.id, inviteId),
          eq(schema.instructorSchools.instructorId, instructor.id),
          eq(schema.instructorSchools.source, 'school_invite'),
          eq(schema.instructorSchools.status, 'pending'),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Invite not found or already processed');
    }

    return updated;
  }

  async cancelJoinRequest(userId: string, schoolId: string) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    const [deletedRequest] = await this.db
      .delete(schema.instructorSchools)
      .where(
        and(
          eq(schema.instructorSchools.instructorId, instructor.id),
          eq(schema.instructorSchools.schoolId, schoolId),
          eq(schema.instructorSchools.status, 'pending'),
          eq(schema.instructorSchools.source, 'instructor_request'),
        ),
      )
      .returning();

    if (!deletedRequest) {
      throw new NotFoundException('Pending join request not found');
    }

    return { success: true, message: 'Request cancelled successfully' };
  }

  async togglePauseStatus(userId: string, schoolId: string, pause: boolean) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    const expectedCurrentStatus = pause ? 'accepted' : 'paused';
    const newStatus = pause ? 'paused' : 'accepted';

    const [updated] = await this.db
      .update(schema.instructorSchools)
      .set({ status: newStatus })
      .where(
        and(
          eq(schema.instructorSchools.instructorId, instructor.id),
          eq(schema.instructorSchools.schoolId, schoolId),
          eq(schema.instructorSchools.status, expectedCurrentStatus),
        ),
      )
      .returning();

    if (!updated) {
      throw new ConflictException(
        `Cannot change pause status. Current status might not be '${expectedCurrentStatus}'.`,
      );
    }

    return updated;
  }

  async deactivateMembership(userId: string, schoolId: string) {
    const [instructor] = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId));

    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }

    const activeBookings = await this.db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.instructorId, instructor.id),
          eq(schema.bookings.schoolId, schoolId),
          inArray(schema.bookings.status, ['pending', 'confirmed']),
        ),
      )
      .limit(1);

    if (activeBookings.length > 0) {
      throw new ConflictException(
        'Cannot deactivate membership. You have active or upcoming bookings with this school. Please complete or cancel them first.',
      );
    }

    const [deletedMembership] = await this.db
      .delete(schema.instructorSchools)
      .where(
        and(
          eq(schema.instructorSchools.instructorId, instructor.id),
          eq(schema.instructorSchools.schoolId, schoolId),
          inArray(schema.instructorSchools.status, ['accepted', 'paused']),
        ),
      )
      .returning();

    if (!deletedMembership) {
      throw new NotFoundException('Active school membership not found');
    }

    return {
      success: true,
      message: 'Successfully deactivated and left the school',
    };
  }
}
