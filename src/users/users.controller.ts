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

@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: UserEntity) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserAvatar(
    @UploadedFile(fileValidationPipe) file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.usersService.updateAvatar(user.id, file);
  }
}
