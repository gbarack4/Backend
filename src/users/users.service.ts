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
import { eq } from 'drizzle-orm';
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

  async upsertUser(data: {
    clerkUserId: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
  }) {
    const [user] = await this.db
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
        set: {
          email: data.email,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          address: data.address,
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

    try {
      const uploadResult = await this.s3Service.uploadUserAvatar(file);

      const [updatedUser] = await this.db
        .update(schema.users)
        .set({ avatarUrl: uploadResult.fileUrl })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new NotFoundException('User not found during avatar update');
      }

      if (user.avatarUrl) {
        try {
          await this.s3Service.deleteFile(user.avatarUrl);
        } catch (err) {
          this.logger.warn(
            `Failed to delete old avatar: ${user.avatarUrl}`,
            err,
          );
        }
      }

      return {
        message: 'Avatar updated successfully',
        avatarUrl: uploadResult.fileUrl,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Avatar update failed for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to process avatar upload');
    }
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
      role: user.role,
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
