import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';

import { CreditsService } from './credits.service';

@Controller('credits')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('school/:schoolId/balance')
  @Roles(Role.Student)
  async getBalance(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
  ) {
    return this.creditsService.getStudentBalance(user.id, schoolId);
  }
}
