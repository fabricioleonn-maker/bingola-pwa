import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { BillingService, VerifyDto } from './billing.service';

@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Post('verify')
    async verify(@Body() dto: VerifyDto) {
        if (!dto.platform || !dto.store || !dto.product_id || !dto.token_or_tx_id || !dto.userId) {
            throw new BadRequestException('Missing required fields');
        }
        return this.billingService.verifyPurchase(dto);
    }
}
