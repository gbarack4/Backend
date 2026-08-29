import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { StripeWebhookService } from './stripe-webhook.service';

@Controller('payments')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    const rawBody = request.rawBody;

    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    const event = this.stripeWebhookService.constructEvent(rawBody, signature);

    await this.stripeWebhookService.handleEvent(event);

    return {
      received: true,
    };
  }
}
