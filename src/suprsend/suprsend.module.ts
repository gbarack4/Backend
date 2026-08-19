import { Global, Module } from '@nestjs/common';

import { SuprSendService } from './suprsend.service';

@Global()
@Module({
  providers: [SuprSendService],
  exports: [SuprSendService],
})
export class SuprSendModule {}
