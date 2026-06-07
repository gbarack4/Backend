import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SetupSchoolDto } from './dto/setup-school.dto';
import { UsersService } from '../users/users.service';
import {
  ClerkAuthGuard,
  type RequestWithUser,
} from '../auth/guards/clerk-auth.guard';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('setup')
  @UseGuards(ClerkAuthGuard)
  async setup(@Req() req: RequestWithUser, @Body() dto: SetupSchoolDto) {
    const clerkId = req.user?.sub;

    if (!clerkId) {
      throw new UnauthorizedException('Invalid user token payload');
    }

    const dbUser = await this.usersService.findByClerkId(clerkId);

    if (!dbUser) {
      throw new UnauthorizedException('User record not found in database');
    }

    return this.schoolsService.setupNewSchool(dbUser.id, dto);
  }
}
