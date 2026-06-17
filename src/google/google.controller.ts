import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  Redirect,
  Post,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inspect } from 'node:util';
import { GoogleService } from './google.service';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { GoogleAuthStatus } from './constants/google.constants';
import { FRONTEND_ROUTES } from '@/common/constants/frontend-routes.constant';
import { TimezoneService } from './timezone.service';
import { DetectTimezoneDto } from './dto/detect-timezone.dto';

@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly googleService: GoogleService,
    private readonly timezoneService: TimezoneService,
    configService: ConfigService,
  ) {
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') ??
      'https://admin.driveinstructor.pro';
  }

  @Post('timezone')
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard)
  async detectTimezone(@Body() body: DetectTimezoneDto) {
    return await this.timezoneService.getTimezoneByAddress(body.address);
  }

  @Get('connect')
  @Roles(Role.Owner, Role.Admin)
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  connectGoogle(
    @Query('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    const url = this.googleService.getAuthUrl(schoolId);
    return { url };
  }

  @Get('callback')
  @Redirect('', 302)
  async googleCallback(
    @Query('code') code: string,
    @Query('state') signedState: string,
    @Query('error') error: string,
  ) {
    const buildRedirectUrl = (
      statusKey: 'error' | 'success',
      statusValue: GoogleAuthStatus,
    ) =>
      `${this.frontendUrl}${FRONTEND_ROUTES.INTEGRATIONS}?${statusKey}=${statusValue}`;

    if (error) {
      return { url: buildRedirectUrl('error', GoogleAuthStatus.Denied) };
    }

    if (!code || !signedState) {
      return { url: buildRedirectUrl('error', GoogleAuthStatus.Failed) };
    }

    try {
      await this.googleService.handleCallback(code, signedState);
      return { url: buildRedirectUrl('success', GoogleAuthStatus.Success) };
    } catch (err: unknown) {
      const errorDetails = err instanceof Error ? err.stack : inspect(err);
      this.logger.error('Failed to handle Google OAuth callback', errorDetails);

      return { url: buildRedirectUrl('error', GoogleAuthStatus.InternalError) };
    }
  }

  @Get(':schoolId/locations')
  @Roles(Role.Owner, Role.Admin)
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  async getLocations(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.googleService.fetchAvailableLocations(schoolId);
  }

  @Post(':schoolId/locations')
  @Roles(Role.Owner, Role.Admin)
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  async saveLocation(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Body('locationName') locationName: string,
    @Body('accountName') accountName: string,
  ) {
    if (!locationName || !accountName) {
      throw new BadRequestException(
        'locationName and accountName are required',
      );
    }

    await this.googleService.setBusinessLocation(
      schoolId,
      locationName,
      accountName,
    );

    return { success: true };
  }

  @Get(':schoolId/reviews')
  @Roles(Role.Owner, Role.Admin)
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  async getReviews(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.googleService.getSchoolReviews(schoolId);
  }
}
