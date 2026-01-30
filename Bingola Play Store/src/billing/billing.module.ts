import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [WalletModule, CommonModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule { }
