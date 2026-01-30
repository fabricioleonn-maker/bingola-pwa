
import React, { useState } from 'react';
import { useUserStore } from '../state/userStore';
import { useNotificationStore } from '../state/notificationStore';
import { supabase } from '../lib/supabase';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const { refreshProfile, profile } = useUserStore();
    const { show } = useNotificationStore();

    if (!isOpen) return null;

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 30);

            const { error } = await supabase
                .from('profiles')
                .update({ subscription_end_date: nextMonth.toISOString() })
                .eq('id', profile?.id);

            if (error) {
                console.error('Erro detalhado:', error);
                throw new Error(error.message || 'Falha ao atualizar assinatura');
            }

            await refreshProfile();
            show('Parabéns! Você agora é PREMIUM!', 'success');
            onClose();
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes('column "subscription_end_date" of relation "profiles" does not exist')) {
                show('Erro: O banco de dados precisa ser atualizado (SQL).', 'error');
            } else {
                show('Erro ao processar assinatura. Tente novamente.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-sm bg-stone-950 rounded-[2.5rem] p-8 border-2 border-yellow-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center overflow-hidden">

                {/* Decorative background glow - Gold for Premium */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="mb-8 relative">
                    <div className="size-24 bg-gradient-to-b from-yellow-400/20 to-transparent rounded-full flex items-center justify-center mb-4 mx-auto ring-1 ring-yellow-500/30">
                        <span className="material-symbols-outlined text-6xl text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]">crown</span>
                    </div>
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Plano Premium</h2>
                    <p className="text-yellow-500/60 text-xs font-black uppercase tracking-widest mt-1">Acesso Ilimitado</p>
                </div>

                <div className="space-y-3 w-full mb-10 relative z-10">
                    {[
                        { icon: 'percent', text: '10% de Desconto em BCOINS' },
                        { icon: 'palette', text: 'Todos os Temas Liberados' },
                        { icon: 'font_download', text: 'Fontes Exclusivas' },
                        { icon: 'diamond', text: 'Ícones Especiais' },
                        { icon: 'record_voice_over', text: 'Vozes VIP (Em breve)' }
                    ].map((benefit, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5 hover:border-yellow-500/20 transition-all group">
                            <span className="material-symbols-outlined text-yellow-500 group-hover:scale-110 transition-transform">{benefit.icon}</span>
                            <span className="text-sm font-bold text-white/80 text-left flex-1">{benefit.text}</span>
                            <span className="material-symbols-outlined text-green-500 text-lg">verified</span>
                        </div>
                    ))}
                </div>

                <div className="w-full relative group">
                    <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                    <button
                        onClick={handleSubscribe}
                        disabled={loading}
                        className="w-full py-5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 rounded-2xl font-black text-black text-lg uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden animate-pulse-slow"
                    >
                        <span className="relative z-10">
                            {loading ? 'Processando...' : 'Assinar Agora'}
                        </span>
                    </button>
                    <p className="text-[10px] text-white/30 font-bold mt-3 uppercase tracking-widest">Apenas R$ 9,90/mês</p>
                </div>

                <button onClick={onClose} className="mt-6 text-[10px] font-black text-white/20 hover:text-white/60 uppercase tracking-[0.2em] transition-colors">
                    Voltar para a Loja
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.95; transform: scale(1.01); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}} />
        </div>
    );
};
