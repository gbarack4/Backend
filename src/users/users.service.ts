import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { DB_CONNECTION } from '@/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@/database/schema';
import { S3Service } from '@/storage/s3.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly s3Service: S3Service,
  ) {}

  async upsertUser(
    data: {
      clerkUserId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      phoneNumber?: string;
      address?: string;
    },
    tx: NodePgDatabase<typeof schema> = this.db,
  ) {
    const [user] = await tx
      .insert(schema.users)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        phoneNumber: data.phoneNumber,
        address: data.address,
      })
      .onConflictDoUpdate({
        target: schema.users.clerkUserId,
        set: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          address: data.address,
          avatarUrl: data.avatarUrl
            ? sql`
              CASE
                WHEN ${schema.users.avatarUrl} IS NULL THEN ${data.avatarUrl}
                WHEN ${schema.users.avatarUrl} LIKE '%clerk.com%' THEN ${data.avatarUrl}
                ELSE ${schema.users.avatarUrl}
              END
            `
            : sql`${schema.users.avatarUrl}`,
        },
      })
      .returning();

    return user;
  }

  async removeUserByClerkId(clerkUserId: string) {
    return this.db
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

  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    return user;
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let uploadedFileUrl: string | null = null;

    try {
      const uploadResult = await this.s3Service.uploadUserAvatar(file);
      uploadedFileUrl = uploadResult.fileUrl;

      await this.updateUserAvatarInDb(userId, uploadedFileUrl);
      await this.safelyDeleteOldAvatar(user.avatarUrl);

      return {
        message: 'Avatar updated successfully',
        avatarUrl: uploadedFileUrl,
      };
    } catch (error) {
      this.handleAvatarUpdateError(error, userId, uploadedFileUrl);
    }
  }

  private async updateUserAvatarInDb(userId: string, avatarUrl: string) {
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({ avatarUrl })
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new NotFoundException('User not found during avatar update');
    }
  }

  private async safelyDeleteOldAvatar(avatarUrl: string | null) {
    if (!avatarUrl || avatarUrl.includes('clerk.com')) {
      return;
    }

    try {
      await this.s3Service.deleteFile(avatarUrl);
    } catch (err) {
      const warnMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to delete old avatar: ${avatarUrl}. ${warnMessage}`,
      );
    }
  }

  private handleAvatarUpdateError(
    error: unknown,
    userId: string,
    uploadedFileUrl: string | null,
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (uploadedFileUrl) {
      this.s3Service.deleteFile(uploadedFileUrl).catch(() => {});
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `Avatar update failed for user ${userId}: ${errorMessage}`,
      errorStack,
    );

    throw new InternalServerErrorException('Failed to process avatar upload');
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      avatarUrl: user.avatarUrl,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }
}
