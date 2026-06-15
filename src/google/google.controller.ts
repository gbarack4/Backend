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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inspect } from 'node:util';
import { GoogleService } from './google.service';
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';

@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly googleService: GoogleService,
    configService: ConfigService,
  ) {
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
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
    if (error) {
      return {
        url: `${this.frontendUrl}/integrations?error=google_auth_denied`,
      };
    }

    if (!code || !signedState) {
      return {
        url: `${this.frontendUrl}/integrations?error=google_auth_failed`,
      };
    }

    try {
      await this.googleService.handleCallback(code, signedState);
      return {
        url: `${this.frontendUrl}/integrations?success=google_connected`,
      };
    } catch (err: unknown) {
      const errorDetails = err instanceof Error ? err.stack : inspect(err);
      this.logger.error('Failed to handle Google OAuth callback', errorDetails);

      return { url: `${this.frontendUrl}/integrations?error=internal_error` };
    }
  }

  @Post(':schoolId/sync')
  @Roles(Role.Owner, Role.Admin)
  @UseGuards(ClerkAuthGuard, RequireDbUserGuard, RolesGuard)
  async syncProfile(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.googleService.syncGoogleBusinessProfile(schoolId);
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
