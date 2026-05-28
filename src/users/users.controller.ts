import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import type { Request } from 'express';
import type { JwtPayload } from '@clerk/types';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: Request) {
    const user = req['user'] as JwtPayload;
    return { message: 'User profile', id: user.sub };
  }

  @Roles('owner', 'instructor')
  @Get()
  getStudents() {
    return {
      message:
        'The student list is only accessible to the owner or instructor.',
    };
  }
}
