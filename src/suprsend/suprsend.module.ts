import { Module, Global } from '@nestjs/common';
import { SuprSendService } from './suprsend.service';

@Global()
@Module({
  providers: [SuprSendService],
  exports: [SuprSendService],
})
export class SuprSendModule {}
