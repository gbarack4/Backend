import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/database/schema';
import { OnboardInstructorDto } from './dto/onboard-instructor.dto';
import { S3Service } from '@/storage/s3.service';
import { instructorOnboardingDrafts } from '@/database/schema';
import { UpsertDraftDto } from './dto/upsert-draft.dto';

@Injectable()
export class InstructorsService {
  private readonly logger = new Logger(InstructorsService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly s3Service: S3Service,
  ) {}

  async onboard(clerkUserId: string, dto: OnboardInstructorDto) {
    const userRecords = await this.db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phoneNumber: schema.users.phoneNumber,
      })
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    if (!userRecords.length) {
      throw new NotFoundException('Global user identity not found');
    }

    const identity = userRecords[0];
    const fullName =
      [identity.firstName, identity.lastName].filter(Boolean).join(' ') ||
      'Instructor';

    const existingInstructor = await this.db
      .select({ id: schema.instructors.id })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, identity.id))
      .limit(1);

    if (existingInstructor.length) {
      throw new ConflictException(
        'An instructor profile already exists for this account',
      );
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [newInstructor] = await tx
          .insert(schema.instructors)
          .values({
            userId: identity.id,
            name: fullName,
            phone: identity.phoneNumber,
            bio: dto.bio || null,
            avatarUrl: dto.profilePhotoUri || null,
            addressLine1: dto.address.line1,
            addressLine2: dto.address.line2 || null,
            suburb: dto.address.suburb,
            state: dto.address.state,
            postcode: dto.address.postcode,
            emergencyContact: {
              name: dto.emergencyContactName,
              phone: dto.emergencyContactPhone,
            },
            driverLicenceNumber: dto.driverLicenceNumber,
            driverLicenceExpiry: dto.driverLicenceExpiry,
            instructorAccreditationNumber: dto.instructorAccreditationNumber,
            accreditationExpiry: dto.accreditationExpiry,
            yearsOfExperience: Number.parseInt(dto.yearsOfExperience) || 0,
            transmissionType: dto.transmissionType,
            languagesSpoken: dto.languagesSpoken,
            documents: dto.documents,
            status: 'active',
          })
          .returning();

        await tx.insert(schema.cars).values({
          instructorId: newInstructor.id,
          make: dto.vehicleMake,
          model: dto.vehicleModel,
          year: Number.parseInt(dto.vehicleYear),
          registrationNumber: dto.registrationNumber,
          transmission:
            dto.vehicleTransmission === 'automatic' ? 'Automatic' : 'Manual',
          dualControl: dto.dualControlVehicle === 'yes',
          color: 'Unspecified',
          fuel: 'Petrol',
        });

        await tx
          .delete(schema.instructorOnboardingDrafts)
          .where(
            eq(schema.instructorOnboardingDrafts.clerkUserId, clerkUserId),
          );

        return {
          success: true,
          message: 'Instructor profile successfully created',
          instructorId: newInstructor.id,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to onboard instructor: ${error}`);
      throw new InternalServerErrorException(
        'Failed to create instructor profile',
      );
    }
  }

  async uploadAvatar(file: Express.Multer.File) {
    try {
      const uploadResult = await this.s3Service.uploadInstructorAvatar(file);

      return {
        success: true,
        avatarUrl: uploadResult.fileUrl,
        key: uploadResult.key,
      };
    } catch (error) {
      this.logger.error(`Failed to upload instructor avatar to S3: ${error}`);
      throw new InternalServerErrorException('Could not process avatar upload');
    }
  }

  async uploadDocument(file: Express.Multer.File) {
    try {
      const uploadResult = await this.s3Service.uploadInstructorDocument(file);

      return {
        success: true,
        fileUrl: uploadResult.fileUrl,
        key: uploadResult.key,
      };
    } catch (error) {
      this.logger.error(`Failed to upload instructor document to S3: ${error}`);
      throw new InternalServerErrorException(
        'Could not process document upload',
      );
    }
  }

  async getDraft(clerkUserId: string) {
    const draft = await this.db.query.instructorOnboardingDrafts.findFirst({
      where: eq(instructorOnboardingDrafts.clerkUserId, clerkUserId),
    });

    return draft || { currentStepIndex: 0, formData: {} };
  }

  async upsertDraft(clerkUserId: string, dto: UpsertDraftDto) {
    await this.db
      .insert(instructorOnboardingDrafts)
      .values({
        clerkUserId,
        currentStepIndex: dto.currentStepIndex,
        formData: dto.formData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: instructorOnboardingDrafts.clerkUserId,
        set: {
          currentStepIndex: dto.currentStepIndex,
          formData: dto.formData,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  }

  async getProfile(clerkUserId: string) {
    const userRecords = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    if (!userRecords.length) {
      throw new NotFoundException('Global user identity not found');
    }

    const userId = userRecords[0].id;

    const profileRecords = await this.db
      .select({
        instructor: schema.instructors,
        car: schema.cars,
      })
      .from(schema.instructors)
      .where(eq(schema.instructors.userId, userId))
      .leftJoin(
        schema.cars,
        eq(schema.cars.instructorId, schema.instructors.id),
      );

    if (!profileRecords.length) {
      throw new NotFoundException('Instructor profile not found');
    }

    const { instructor, car } = profileRecords[0];

    return {
      success: true,
      data: {
        ...instructor,
        car: car || null,
      },
    };
  }
}
