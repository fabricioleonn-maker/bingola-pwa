import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';

// The URL of our new monetization backend (NestJS)
const MONETIZATION_API_URL = 'http://localhost:3001';

interface UserProfile {
    id: string;
    username: string;
    email?: string;
    bcoins: number;
    bpoints: number;
    referral_code: string;
    avatar_url: string | null;
    level: number;
    subscription_end_date?: string | null;
    role?: string | null;
}

interface UserStore {
    profile: UserProfile | null;
    loading: boolean;
    isPremium: boolean;
    isMaster: boolean;
    isEditMode: boolean;
    setEditMode: (active: boolean) => void;
    editingElement: { id: string, text: string } | null;
    setEditingElement: (el: { id: string, text: string } | null) => void;
    refreshProfile: () => Promise<void>;
    verifyPurchase: (platform: 'android' | 'ios', store: 'google_play' | 'apple_app_store', productId: string, token: string) => Promise<boolean>;
    debitCoins: (amount: number, reason: string) => Promise<boolean>;
}

export const useUserStore = create<UserStore>((set, get) => ({
    profile: null,
    loading: false,
    isPremium: false,
    isMaster: false,
    isEditMode: false,
    editingElement: null,

    setEditMode: (active) => set({ isEditMode: active }),
    setEditingElement: (el) => set({ editingElement: el }),

    refreshProfile: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        set({ loading: true });

        try {
            // SELECT first to avoid overwriting existing bcoins/level
            let { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            // Only INSERT if profile doesn't exist
            if (!profile) {
                console.log('[UserStore] Profile not found, creating...');
                const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
                    id: user.id,
                    username: user.user_metadata?.username || user.email?.split('@')[0] || 'Usuário',
                    email: user.email,
                    bcoins: 10,  // Initial BCoins for new users
                    level: 1
                }).select('*').single();

                if (insertError) {
                    console.error('[UserStore] Profile insert error:', insertError);
                    set({ loading: false });
                    return;
                }

                profile = newProfile;
            }

            if (profile) {
                const isPremium = profile.subscription_end_date ? new Date(profile.subscription_end_date) > new Date() : false;
                const isMasterCheck = user.email?.toLowerCase() === 'fabricio.leonn@gmail.com' || profile.role === 'master';
                set({ profile: profile as UserProfile, isPremium, isMaster: isMasterCheck });

                console.log('[UserStore] Profile loaded:', profile.username, 'BCoins:', profile.bcoins);
            }
        } catch (err) {
            console.error('[UserStore] Unexpected error:', err);
        } finally {
            set({ loading: false });
        }
    },

    verifyPurchase: async (platform, store, productId, token) => {
        const { profile } = get();
        if (!profile) return false;

        try {
            set({ loading: true });
            const response = await fetch(`${MONETIZATION_API_URL}/billing/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    platform,
                    store,
                    product_id: productId,
                    token_or_tx_id: token,
                    userId: profile.id,
                }),
            });

            const result = await response.json();

            if (result.success) {
                useNotificationStore.getState().show(`Sucesso! +${result.granted_bcoins} BCOINS adicionados.`, 'success');
                await get().refreshProfile();
                return true;
            } else {
                useNotificationStore.getState().show(result.message || 'Falha na verificação da compra.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error verifying purchase:', error);
            useNotificationStore.getState().show('Erro de conexão com o servidor de pagamentos.', 'error');
            return false;
        } finally {
            set({ loading: false });
        }
    },

    debitCoins: async (amount, reason) => {
        const { profile } = get();
        if (!profile) return false;

        try {
            set({ loading: true });
            const response = await fetch(`${MONETIZATION_API_URL}/wallet/debit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: profile.id,
                    amount,
                    reason,
                }),
            });

            const result = await response.json();

            if (result.success) {
                await get().refreshProfile();
                return true;
            } else {
                useNotificationStore.getState().show(result.message || 'Saldo insuficiente.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error debiting coins:', error);
            return false;
        } finally {
            set({ loading: false });
        }
    }
}));
