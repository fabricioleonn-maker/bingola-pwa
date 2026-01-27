
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const RewardNotificationModal: React.FC = () => {
    const [reward, setReward] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkRewards = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('referral_rewards')
                .select('*')
                .eq('referrer_id', user.id)
                .eq('is_claimed', false)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (data && !error) {
                setReward(data);
                setIsVisible(true);
            }
        };

        // Check every 30 seconds for new rewards if not currently showing one
        if (!isVisible) {
            checkRewards();
            interval = setInterval(checkRewards, 30000);
        }

        return () => clearInterval(interval);
    }, [isVisible]);

    const handleClaim = async () => {
        if (!reward) return;

        // Mark as claimed
        const { error } = await supabase
            .from('referral_rewards')
            .update({ is_claimed: true })
            .eq('id', reward.id);

        if (!error) {
            setIsVisible(false);
            setReward(null);
        }
    };

    if (!isVisible || !reward) return null;

    return (
        <div className="fixed inset-0 z-[500] bg-background-dark/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-[380px] bg-surface-dark border border-white/10 rounded-[3rem] p-10 text-center relative overflow-hidden shadow-2xl">
                {/* Gratification Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/20 blur-[80px] -mt-24"></div>

                <div className="relative z-10">
                    <div className="size-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/20 animate-bounce">
                        <span className="material-symbols-outlined text-black text-5xl font-black">card_giftcard</span>
                    </div>

                    <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2 uppercase">GRATIFICAÇÃO!</h2>
                    <p className="text-white/40 text-sm mb-10 font-medium">Você recebeu um bônus por trazer um novo jogador para o Bingola!</p>

                    <div className="bg-white/5 rounded-3xl p-6 mb-10 space-y-4 border border-white/5">
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest leading-none">Indicação de:</p>
                            <p className="text-white font-black text-lg">@{reward.buyer_name}</p>
                        </div>
                        <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                            <span className="text-white/20 font-black uppercase tracking-widest">Recompensa</span>
                            <span className="text-primary font-black">+{reward.amount} BCOINS</span>
                        </div>
                    </div>

                    <button
                        onClick={handleClaim}
                        className="w-full h-16 bg-primary text-black font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
                    >
                        Receber Bônus
                    </button>
                </div>
            </div>
        </div>
    );
};
