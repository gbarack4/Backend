import {
  Controller,
  Post,
  Req,
  Res,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import type { Request, Response } from 'express';
import { UsersService } from './users.service';

interface ClerkUserEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    public_metadata?: { role?: string };
  };
}

@Controller('api/webhooks/clerk')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const secret = this.configService.get<string>('CLERK_WEBHOOK_SECRET');

    if (!secret) {
      throw new Error(
        'CLERK_WEBHOOK_SECRET is not set in environment variables',
      );
    }

    const payload = req.rawBody?.toString('utf8');

    if (!payload) {
      throw new BadRequestException('No payload found');
    }

    const svixHeaders = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    };

    let event: ClerkUserEvent;
    try {
      const webhook = new Webhook(secret);
      event = webhook.verify(payload, svixHeaders) as ClerkUserEvent;
    } catch (err: unknown) {
      throw new BadRequestException('Invalid Webhook Signature', {
        cause: err,
      });
    }

    const eventType = event.type;

    try {
      if (eventType === 'user.created' || eventType === 'user.updated') {
        const { id, email_addresses, public_metadata } = event.data;

        const email = email_addresses?.[0]?.email_address;

        if (!email) {
          throw new BadRequestException(
            'User email is required but missing from Clerk payload',
          );
        }

        const role = public_metadata?.role || 'student';

        await this.usersService.upsertUser({ clerkUserId: id, email, role });
      }
      if (eventType === 'user.deleted') {
        await this.usersService.removeUserByClerkId(event.data.id);
      }

      return res.status(HttpStatus.OK).json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Webhook processing error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Webhook processing error: ${JSON.stringify(error)}`);
      }

      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false });
    }
  }
}
