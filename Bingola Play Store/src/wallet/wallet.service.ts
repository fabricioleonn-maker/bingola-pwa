import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

export enum LedgerType {
    CREDIT = 'CREDIT',
    DEBIT = 'DEBIT',
}

export enum LedgerReason {
    PLAY_PURCHASE = 'PLAY_PURCHASE',
    APPLE_PURCHASE = 'APPLE_PURCHASE',
    CREATE_TABLE = 'CREATE_TABLE',
    REFUND = 'REFUND',
    ADMIN_ADJUST = 'ADMIN_ADJUST',
}

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);

    constructor(private supabase: SupabaseService) { }

    async getBalance(userId: string): Promise<number> {
        const { data, error } = await this.supabase
            .getClient()
            .from('profiles')
            .select('bcoins')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            this.logger.error(`Error fetching balance for user ${userId}: ${error.message}`);
            throw error;
        }

        return data?.bcoins || 0;
    }

    async credit(
        userId: string,
        amount: number,
        reason: LedgerReason,
        purchaseId?: string,
        metadata?: any,
    ) {
        const client = this.supabase.getClient();

        // In a real Supabase environment, we'd use a postgres function (RPC) 
        // to ensure atomic transaction between wallet update and ledger insert.
        // For this POC/Test project B, we will call an RPC 'credit_wallet'.

        const { data, error } = await client.rpc('credit_wallet', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_purchase_id: purchaseId,
            p_metadata: metadata,
        });

        if (error) {
            this.logger.error(`Failed to credit wallet for user ${userId}: ${error.message}`);
            throw error;
        }

        return data;
    }

    async debit(
        userId: string,
        amount: number,
        reason: LedgerReason,
        tableId?: string,
        metadata?: any,
    ) {
        const client = this.supabase.getClient();

        const { data, error } = await client.rpc('debit_wallet', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_table_id: tableId,
            p_metadata: metadata,
        });

        if (error) {
            this.logger.error(`Failed to debit wallet for user ${userId}: ${error.message}`);
            throw error;
        }

        return data;
    }

    async getLedger(userId: string, limit = 50) {
        const { data, error } = await this.supabase
            .getClient()
            .from('wallet_ledger')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            this.logger.error(`Error fetching ledger for user ${userId}: ${error.message}`);
            throw error;
        }

        return data;
    }
}
