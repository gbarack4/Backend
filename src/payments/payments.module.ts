import { Module } from '@nestjs/common';

import { CreditsModule } from '@/credits/credits.module';
import { StripeModule } from '@/stripe/stripe.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [StripeModule, CreditsModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, StripeWebhookService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
