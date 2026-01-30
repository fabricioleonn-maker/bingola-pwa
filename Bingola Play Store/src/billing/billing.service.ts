import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../common/supabase.service';
import { WalletService, LedgerReason } from '../wallet/wallet.service';
import { google } from 'googleapis';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export enum PurchaseStatus {
    RECEIVED = 'RECEIVED',
    VERIFIED = 'VERIFIED',
    GRANTED = 'GRANTED',
    REJECTED = 'REJECTED',
    ERROR = 'ERROR',
}

export class VerifyDto {
    platform: 'android' | 'ios';
    store: 'google_play' | 'apple_app_store';
    product_id: string;
    token_or_tx_id: string;
    userId: string;
}

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);
    private googleAndroidPublisher;

    constructor(
        private configService: ConfigService,
        private supabase: SupabaseService,
        private walletService: WalletService,
    ) {
        this.initGooglePublisher();
    }

    private initGooglePublisher() {
        try {
            const jsonPath = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
            if (jsonPath) {
                const absolutePath = join(process.cwd(), jsonPath);
                if (existsSync(absolutePath)) {
                    const auth = new google.auth.GoogleAuth({
                        keyFile: absolutePath,
                        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
                    });
                    this.googleAndroidPublisher = google.androidpublisher({
                        version: 'v3',
                        auth,
                    });
                    this.logger.log('Google Android Publisher initialized');
                } else {
                    this.logger.warn(`Google Service Account file not found at ${absolutePath}. Using mock mode.`);
                }
            }
        } catch (e) {
            this.logger.warn('Google Service Account initialization failed. Google validation will fail or use mock.');
        }
    }

    async verifyPurchase(dto: VerifyDto) {
        const { platform, store, product_id, token_or_tx_id, userId } = dto;
        const client = this.supabase.getClient();

        // 1. Check if already granted (Idempotency)
        const { data: existing } = await client
            .from('store_purchases')
            .select('status, id')
            .eq('token_or_tx_id', token_or_tx_id)
            .maybeSingle();

        if (existing?.status === PurchaseStatus.GRANTED) {
            this.logger.log(`Purchase ${token_or_tx_id} already GRANTED.`);
            return { success: true, message: 'Already granted', purchase_id: existing.id };
        }

        // 2. Fetch product details
        const { data: product } = await client
            .from('product_catalog')
            .select('*')
            .eq('product_id', product_id)
            .single();

        if (!product) {
            throw new BadRequestException('Invalid product_id');
        }

        // 3. Create or update purchase record
        const { data: purchase, error: upsertError } = await client
            .from('store_purchases')
            .upsert({
                user_id: userId,
                platform,
                store,
                product_id,
                store_product_id: platform === 'android' ? product.store_google_sku : product.store_apple_product_id,
                token_or_tx_id,
                status: PurchaseStatus.RECEIVED,
                updated_at: new Date(),
            }, { onConflict: 'token_or_tx_id' })
            .select()
            .single();

        if (upsertError) throw upsertError;

        try {
            let isValid = false;
            let rawResponse = {};

            if (store === 'google_play') {
                isValid = await this.validateGoogle(product.store_google_sku, token_or_tx_id, (res) => {
                    rawResponse = res;
                });
            } else if (store === 'apple_app_store') {
                isValid = await this.validateApple(product.store_apple_product_id, token_or_tx_id, (res) => {
                    rawResponse = res;
                });
            }

            if (!isValid) {
                await client.from('store_purchases').update({ status: PurchaseStatus.REJECTED, raw_provider_response: rawResponse }).eq('id', purchase.id);
                return { success: false, message: 'Provider validation failed' };
            }

            // 4. Grant BCOINS (Atomic Transaction via RPC)
            const ledgerReason = store === 'google_play' ? LedgerReason.PLAY_PURCHASE : LedgerReason.APPLE_PURCHASE;

            const creditResult = await this.walletService.credit(
                userId,
                product.bcoins_amount,
                ledgerReason,
                purchase.id,
                { store, platform, token_or_tx_id }
            );

            // 5. Finalize status
            await client.from('store_purchases').update({
                status: PurchaseStatus.GRANTED,
                raw_provider_response: rawResponse
            }).eq('id', purchase.id);

            // 6. Consume (Google Only)
            if (store === 'google_play') {
                await this.consumeGoogle(product.store_google_sku, token_or_tx_id);
            }

            return {
                success: true,
                granted_bcoins: product.bcoins_amount,
                new_balance: creditResult.new_balance,
                purchase_id: purchase.id
            };

        } catch (e) {
            this.logger.error(`Error verifying purchase: ${e.message}`, e.stack);
            await client.from('store_purchases').update({ status: PurchaseStatus.ERROR }).eq('id', purchase.id);
            throw e;
        }
    }

    private async validateGoogle(sku: string, token: string, onResponse: (res) => void): Promise<boolean> {
        if (!this.googleAndroidPublisher) {
            this.logger.warn('Google Publisher not initialized, returning mock valid for dev');
            return true; // Mock for dev
        }

        const packageName = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
        const res = await this.googleAndroidPublisher.purchases.products.get({
            packageName,
            productId: sku,
            token,
        });

        onResponse(res.data);

        // 0: Purchased, 1: Canceled, 2: Pending
        return res.data.purchaseState === 0;
    }

    private async consumeGoogle(sku: string, token: string) {
        if (!this.googleAndroidPublisher) return;
        const packageName = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
        try {
            await this.googleAndroidPublisher.purchases.products.consume({
                packageName,
                productId: sku,
                token,
            });
            this.logger.log(`Google purchase consumed: ${token}`);
        } catch (e) {
            this.logger.error(`Failed to consume Google purchase: ${e.message}`);
        }
    }

    private async validateApple(productId: string, transactionId: string, onResponse: (res) => void): Promise<boolean> {
        // Apple validation is a placeholder for now
        this.logger.log(`Apple validation stub for ${productId} / ${transactionId}`);
        onResponse({ mock: 'apple_stub' });
        return true; // Mock valid
    }
}
