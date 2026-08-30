import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { UserEntity } from '@/auth/interfaces/auth.interface';

import { CreatePackagePaymentDto } from './dto/create-package-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('school/:schoolId/package')
  @Roles(Role.Student)
  @ApiOperation({
    summary: 'Create package payment',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
  })
  async createPackagePayment(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Body() dto: CreatePackagePaymentDto,
  ) {
    return this.paymentsService.createPackagePayment(user.id, schoolId, dto);
  }

  @Get('school/:schoolId/package/:bookingId/status')
  @Roles(Role.Student)
  async getPackagePaymentStatus(
    @CurrentUser() user: UserEntity,
    @Param('schoolId', new ParseUUIDPipe({ version: '4' }))
    schoolId: string,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' }))
    bookingId: string,
  ) {
    return this.paymentsService.getPackagePaymentStatus(user.id, schoolId, bookingId);
  }
}
