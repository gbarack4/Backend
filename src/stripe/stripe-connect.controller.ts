import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { SchoolRolesGuard } from '@/auth/guards/school-roles.guard';

import { StripeConnectService } from './stripe-connect.service';

@ApiTags('Stripe Connect')
@ApiBearerAuth()
@Controller('stripe-connect')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, SchoolRolesGuard)
@RequirePermission('edit')
@ApiHeader({
  name: 'x-school-id',
  required: true,
})
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post('onboarding')
  createOnboardingLink(@Headers('x-school-id') schoolId: string) {
    return this.stripeConnectService.createOnboardingLink(schoolId);
  }

  @Get('status')
  getAccountStatus(@Headers('x-school-id') schoolId: string) {
    return this.stripeConnectService.getAccountStatus(schoolId);
  }
}
