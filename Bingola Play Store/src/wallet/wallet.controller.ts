import { Controller, Get, Post, Body, Query, Param, BadRequestException } from '@nestjs/common';
import { WalletService, LedgerReason } from './wallet.service';

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Get('balance/:userId')
    async getBalance(@Param('userId') userId: string) {
        const balance = await this.walletService.getBalance(userId);
        return { userId, balance };
    }

    @Get('ledger/:userId')
    async getLedger(@Param('userId') userId: string, @Query('limit') limit: string) {
        const records = await this.walletService.getLedger(userId, limit ? parseInt(limit) : 50);
        return { userId, records };
    }

    @Post('debit')
    async debit(@Body() body: { userId: string, amount: number, reason: string, tableId?: string, metadata?: any }) {
        const { userId, amount, reason, tableId, metadata } = body;

        // Map string reason to enum
        const ledgerReason = LedgerReason[reason as keyof typeof LedgerReason];
        if (!ledgerReason) {
            throw new BadRequestException('Invalid reason');
        }

        return this.walletService.debit(userId, amount, ledgerReason, tableId, metadata);
    }
}
