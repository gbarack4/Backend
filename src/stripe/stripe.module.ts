import { Module } from '@nestjs/common';

import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectService } from './stripe-connect.service';
import { StripeService } from './stripe.service';

@Module({
  controllers: [StripeConnectController],
  providers: [StripeService, StripeConnectService],
  exports: [StripeService, StripeConnectService],
})
export class StripeModule {}
