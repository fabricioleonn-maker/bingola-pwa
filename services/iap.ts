import 'cordova-plugin-purchase';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';

class IAPService {
    private isInitialized = false;

    async initialize() {
        if (this.isInitialized) return;

        if (!window.CdvPurchase) {
            console.warn('CdvPurchase not available. Are you on a native device?');
            return;
        }

        const { store, ProductType, Platform } = window.CdvPurchase;

        // Register Products (Ideally this list comes from your DB or constants)
        // For now, we fetch from the catalog or define standard IDs
        // You should sync this list with what is in the "product_catalog" table
        const { data: catalog } = await supabase.from('product_catalog').select('store_google_sku');
        const googleProducts = catalog?.map(c => ({
            id: c.store_google_sku,
            type: ProductType.CONSUMABLE,
            platform: Platform.GOOGLE_PLAY,
        })) || [];

        // Add Premium Subscription
        googleProducts.push({
            id: 'bingola_premium_monthly',
            type: ProductType.PAID_SUBSCRIPTION,
            platform: Platform.GOOGLE_PLAY,
        });

        store.register(googleProducts);

        // Setup Listeners
        store.when()
            .approved(transaction => {
                // Verify on backend
                console.log('Transaction approved:', transaction);
                this.verifyAndFinish(transaction);
            })
            .verified(receipt => {
                console.log('Receipt verified:', receipt);
                receipt.finish();
            })
            .finished(transaction => {
                console.log('Transaction finished:', transaction);
            })
            // @ts-ignore
            .cancelled((transaction: any) => {
                useNotificationStore.getState().show('Compra cancelada pelo usuário.', 'info');
            })
            .error(error => {
                console.error('Store Error:', error);
                useNotificationStore.getState().show(`Erro na loja: ${error.message}`, 'error');
            });

        await store.initialize();
        this.isInitialized = true;
        console.log('IAP Service Initialized');
    }

    async verifyAndFinish(transaction: CdvPurchase.Transaction) {
        const { verifyPurchase } = useUserStore.getState();
        const productId = transaction.products[0]?.id;

        // In CdvPurchase v13+, we usually get a verification token
        // This logic depends heavily on the specific version API, effectively we send the receipt to our backend
        // Our backend (NestJS) will verify with Google

        // Note: transaction.purchaseToken or similar is needed here.
        // Assuming we pass the opaque token for backend verification.
        const token = (transaction as any).purchaseToken;

        if (!productId || !token) {
            console.error("Missing productId or token in transaction", transaction);
            return;
        }

        const success = await verifyPurchase('android', 'google_play', productId, token);

        if (success) {
            transaction.finish();
            useNotificationStore.getState().show('Compra realizada com sucesso!', 'success');
        } else {
            useNotificationStore.getState().show('Erro ao verificar compra no servidor.', 'error');
        }
    }

    async order(productId: string) {
        if (!window.CdvPurchase) {
            useNotificationStore.getState().show('Loja indisponível neste dispositivo.', 'error');
            return;
        }

        try {
            const { store, Platform } = window.CdvPurchase;
            const product = store.get(productId, Platform.GOOGLE_PLAY);

            if (!product) {
                useNotificationStore.getState().show('Produto não encontrado na loja.', 'error');
                return;
            }

            if (!product.canPurchase) {
                useNotificationStore.getState().show('Produto indisponível para compra no momento.', 'error');
                return;
            }

            product.getOffer()?.order();
        } catch (e: any) {
            console.error(e);
            useNotificationStore.getState().show('Erro ao iniciar compra.', 'error');
        }
    }

    getProducts() {
        if (!window.CdvPurchase) return [];
        const { store, Platform } = window.CdvPurchase;
        // Return products that are VALID and REGISTERED
        // @ts-ignore
        return store.products.filter(p => p.platform === Platform.GOOGLE_PLAY && p.state === (store as any).VALID);
    }
}

export const iapService = new IAPService();
