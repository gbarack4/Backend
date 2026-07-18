import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Get,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { InstructorsService } from './instructors.service';
import { OnboardInstructorDto } from './dto/onboard-instructor.dto';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileValidationPipe } from '@/storage/constants/storage.constants';
import { UpsertDraftDto } from './dto/upsert-draft.dto';
import { OnboardResponse } from './interface/instrutors.interface';

@ApiTags('Instructors')
@ApiBearerAuth()
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Post('onboard')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Onboard a new instructor',
    description:
      'Creates a new instructor profile and their primary vehicle record from the 5-step onboarding form. Does not modify the global identity.',
  })
  @ApiResponse({
    status: 201,
    description: 'Instructor profile and vehicle successfully created.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (e.g., missing required fields).',
  })
  @ApiResponse({
    status: 409,
    description: 'Instructor profile already exists for this account.',
  })
  async onboard(
    @CurrentUser() user: UserEntity,
    @Body() dto: OnboardInstructorDto,
  ): Promise<OnboardResponse> {
    return await this.instructorsService.onboard(user.clerkId, dto);
  }

  @Post('upload-avatar')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload instructor profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Instructor avatar image file (jpeg, png, webp)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Instructor avatar successfully uploaded',
  })
  async uploadAvatar(
    @CurrentUser() user: UserEntity,
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
  ) {
    return await this.instructorsService.uploadAvatar(user.clerkId, file);
  }

  @Post('upload-document')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload instructor document (PDF/Image)' })
  @ApiConsumes('multipart/form-data')
  async uploadDocument(
    @CurrentUser() user: UserEntity,
    @Query('documentType') documentType: string,
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
  ) {
    return await this.instructorsService.uploadDocument(
      user.clerkId,
      documentType,
      file,
    );
  }

  @Get('onboarding/draft')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @ApiOperation({ summary: 'Get current onboarding draft' })
  async getDraft(@CurrentUser() user: UserEntity) {
    return await this.instructorsService.getDraft(user.clerkId);
  }

  @Patch('onboarding/draft')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @ApiOperation({ summary: 'Autosave onboarding draft progress' })
  async saveDraft(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpsertDraftDto,
  ) {
    return await this.instructorsService.upsertDraft(user.clerkId, dto);
  }

  @Get('profile')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  @ApiOperation({
    summary: 'Get completed instructor profile with vehicle details',
  })
  @ApiResponse({
    status: 200,
    description: 'Instructor profile retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Global user identity or instructor profile not found.',
  })
  async getProfile(@CurrentUser() user: UserEntity) {
    return this.instructorsService.getProfile(user.clerkId);
  }
}
