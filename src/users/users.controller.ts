import {
  Controller,
  Get,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  Patch,
  Body,
} from '@nestjs/common';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { fileValidationPipe } from '@/storage/constants/storage.constants';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Users & Profile')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile details' })
  async getProfile(@CurrentUser() user: UserEntity) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile details' })
  @ApiResponse({ status: 200, description: 'Profile successfully updated' })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload or update user avatar image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Avatar image file (jpeg, png)',
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
    description: 'Avatar successfully uploaded and updated',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserAvatar(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.usersService.updateAvatar(user.id, file);
  }
}
