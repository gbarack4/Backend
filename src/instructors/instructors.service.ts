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
import { UpdatePersonalInfoDto } from './dto/update-personal-info.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class InstructorsService {
  private readonly logger = new Logger(InstructorsService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly s3Service: S3Service,
  ) {}

  private buildUserUpdates(dto: UpdatePersonalInfoDto) {
    const updates: Partial<typeof schema.users.$inferInsert> = {};
    if (dto.firstName) updates.firstName = dto.firstName;
    if (dto.lastName) updates.lastName = dto.lastName;
    if (dto.phone) updates.phoneNumber = dto.phone;
    return updates;
  }

  private buildInstructorAddressUpdates(
    address?: UpdatePersonalInfoDto['address'],
  ) {
    if (!address) return {};
    const updates: Partial<typeof schema.instructors.$inferInsert> = {};
    if (address.line1 !== undefined) updates.addressLine1 = address.line1;
    if (address.line2 !== undefined) updates.addressLine2 = address.line2;
    if (address.suburb !== undefined) updates.suburb = address.suburb;
    if (address.state !== undefined) updates.state = address.state;
    if (address.postcode !== undefined) updates.postcode = address.postcode;
    return updates;
  }

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
          transmission: dto.vehicleTransmission,
          dualControl: dto.dualControlVehicle === 'yes',
          color: 'unspecified',
          fuel: 'petrol',
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

  async uploadAvatar(
    clerkUserId: string,
    userId: string,
    file: Express.Multer.File,
    oldFileUrl?: string | null,
  ) {
    try {
      const uploadResult = await this.s3Service.uploadInstructorAvatar(
        clerkUserId,
        file,
        oldFileUrl,
      );

      await this.db
        .update(schema.instructors)
        .set({ avatarUrl: uploadResult.fileUrl })
        .where(eq(schema.instructors.userId, userId));

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

  async uploadDocument(
    clerkUserId: string,
    userId: string,
    documentType: string,
    file: Express.Multer.File,
    oldFileUrl?: string | null,
  ) {
    try {
      const uploadResult = await this.s3Service.uploadInstructorDocument(
        clerkUserId,
        documentType,
        file,
        oldFileUrl,
      );

      const instructor = await this.db.query.instructors.findFirst({
        where: eq(schema.instructors.userId, userId),
      });

      if (!instructor) {
        throw new NotFoundException('Instructor profile not found');
      }

      const updatedDocuments = {
        ...(instructor.documents as Record<string, any>),
        [documentType]: uploadResult.fileUrl,
      };

      await this.db
        .update(schema.instructors)
        .set({ documents: updatedDocuments })
        .where(eq(schema.instructors.id, instructor.id));

      return {
        success: true,
        fileUrl: uploadResult.fileUrl,
        key: uploadResult.key,
        documentType,
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

  async updatePersonalInfo(userId: string, dto: UpdatePersonalInfoDto) {
    try {
      return await this.db.transaction(async (tx) => {
        const userUpdates = this.buildUserUpdates(dto);
        if (Object.keys(userUpdates).length > 0) {
          await tx
            .update(schema.users)
            .set(userUpdates)
            .where(eq(schema.users.id, userId));
        }

        const instructor = await tx.query.instructors.findFirst({
          where: eq(schema.instructors.userId, userId),
        });

        if (!instructor)
          throw new NotFoundException('Instructor profile not found');

        const instructorUpdates: Partial<
          typeof schema.instructors.$inferInsert
        > = {
          ...this.buildInstructorAddressUpdates(dto.address),
        };

        if (dto.phone) instructorUpdates.phone = dto.phone;

        if (dto.firstName || dto.lastName) {
          const [updatedUser] = await tx
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, userId));

          instructorUpdates.name =
            `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim();
        }

        if (Object.keys(instructorUpdates).length > 0) {
          await tx
            .update(schema.instructors)
            .set(instructorUpdates)
            .where(eq(schema.instructors.id, instructor.id));
        }

        return { success: true, message: 'Personal info updated successfully' };
      });
    } catch (error) {
      this.logger.error(`Failed to update personal info: ${error}`);
      throw new InternalServerErrorException('Failed to update personal info');
    }
  }

  async updateVehicle(userId: string, dto: UpdateVehicleDto) {
    try {
      const instructor = await this.db.query.instructors.findFirst({
        where: eq(schema.instructors.userId, userId),
      });

      if (!instructor)
        throw new NotFoundException('Instructor profile not found');

      const carUpdates: Partial<typeof schema.cars.$inferInsert> = {};

      if (dto.make !== undefined) carUpdates.make = dto.make;
      if (dto.model !== undefined) carUpdates.model = dto.model;
      if (dto.year !== undefined) carUpdates.year = Number.parseInt(dto.year);
      if (dto.registrationNumber !== undefined)
        carUpdates.registrationNumber = dto.registrationNumber;
      if (dto.dualControl !== undefined)
        carUpdates.dualControl = dto.dualControl === 'yes';
      if (dto.transmission !== undefined) {
        carUpdates.transmission = dto.transmission;
      }

      if (Object.keys(carUpdates).length > 0) {
        await this.db
          .update(schema.cars)
          .set(carUpdates)
          .where(eq(schema.cars.instructorId, instructor.id));
      }

      return { success: true, message: 'Vehicle updated successfully' };
    } catch (error) {
      this.logger.error(`Failed to update vehicle: ${error}`);
      throw new InternalServerErrorException('Failed to update vehicle');
    }
  }
}
