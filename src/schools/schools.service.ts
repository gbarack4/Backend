import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import { FullSchema } from '@/database/database.types';

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase<FullSchema>) {}

  async getDefaultSchool(userId: string) {
    try {
      const [record] = await this.db
        .select({
          id: schema.schools.id,
          name: schema.schools.name,
          slug: schema.schools.slug,
        })
        .from(schema.schoolUsers)
        .innerJoin(schema.schools, eq(schema.schools.id, schema.schoolUsers.schoolId))
        .where(eq(schema.schoolUsers.userId, userId))
        .orderBy(schema.schoolUsers.createdAt)
        .limit(1);

      return record ?? null;
    } catch (error) {
      this.logger.error(`Failed to get default school for user ${userId}`, error);
      throw new InternalServerErrorException('Could not retrieve default school');
    }
  }

  async getSchoolById(id: string, userId?: string) {
    const school = await this.db.query.schools.findFirst({
      where: eq(schema.schools.id, id),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        description: true,
        coverImageUrl: true,
        logoUrl: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const location = await this.db.query.locations.findFirst({
      where: eq(schema.locations.schoolId, id),
    });

    const primaryDomain = await this.db.query.schoolDomains.findFirst({
      where: and(eq(schema.schoolDomains.schoolId, id), eq(schema.schoolDomains.isPrimary, true)),
    });

    let joinStatus = 'none';

    if (userId) {
      const instructor = await this.db.query.instructors.findFirst({
        where: eq(schema.instructors.userId, userId),
        columns: { id: true },
      });

      if (instructor) {
        const membership = await this.db.query.instructorSchools.findFirst({
          where: and(
            eq(schema.instructorSchools.schoolId, id),
            eq(schema.instructorSchools.instructorId, instructor.id),
          ),
          columns: { status: true },
        });

        if (membership) {
          joinStatus = membership.status;
        }
      }
    }

    const rawReviews = await this.db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        comment: schema.reviews.comment,
        author: schema.students.name,
        date: schema.bookings.createdAt,
      })
      .from(schema.reviews)
      .innerJoin(schema.bookings, eq(schema.reviews.bookingId, schema.bookings.id))
      .innerJoin(schema.students, eq(schema.reviews.studentId, schema.students.id))
      .where(eq(schema.bookings.schoolId, id));

    const reviews = rawReviews.map((rev) => ({
      id: rev.id,
      author: rev.author || 'Anonymous',
      rating: rev.rating,
      date: rev.date ? new Date(rev.date).toLocaleDateString() : '',
      comment: rev.comment,
    }));

    const reviewCount = reviews.length;
    const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
    const rating = reviewCount > 0 ? totalRating / reviewCount : 0;

    const coords = location?.publicCoordinates as { x: number; y: number } | undefined;

    return {
      id: school.id,
      locationId: location?.id || null,
      name: school.name,
      logoUrl: school.logoUrl,
      coverImageUrl: school.coverImageUrl,
      about: school.description,
      address: location?.publicAddressLine1 || null,
      suburb: location?.suburb || null,
      postcode: location?.postcode || null,
      longitude: coords?.x || null,
      latitude: coords?.y || null,
      distance: null,
      rating: Number(rating.toFixed(2)),
      reviewCount: reviewCount,
      phone: school.phone || null,
      email: school.email || null,
      website: primaryDomain?.domain || null,
      reviews: reviews,
      joinStatus: joinStatus,
    };
  }
}
