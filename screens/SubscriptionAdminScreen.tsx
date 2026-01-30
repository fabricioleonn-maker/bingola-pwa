
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';

interface Subscriber {
    id: string;
    username: string;
    email: string;
    subscription_end_date: string;
    avatar_url: string | null;
}

interface Props {
    onBack: () => void;
}

export const SubscriptionAdminScreen: React.FC<Props> = ({ onBack }) => {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const { isMaster } = useUserStore();

    useEffect(() => {
        fetchSubscribers();
    }, []);

    const fetchSubscribers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, subscription_end_date, avatar_url')
            .not('subscription_end_date', 'is', null)
            .order('subscription_end_date', { ascending: false });

        if (!error && data) {
            setSubscribers(data as Subscriber[]);
        }
        setIsLoading(false);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !isMaster) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, subscription_end_date, avatar_url')
            .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
            .limit(10);

        if (!error && data) {
            setSearchResults(data);
        }
        setIsLoading(false);
    };

    const grantPremium = async (userId: string, username: string) => {
        if (!isMaster) return;

        useNotificationStore.getState().confirm({
            title: "Dar Assinatura Premium",
            message: `Deseja conceder 30 dias de Premium para @${username}?`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const nextMonth = new Date();
                    nextMonth.setDate(nextMonth.getDate() + 30);

                    const { error } = await supabase
                        .from('profiles')
                        .update({ subscription_end_date: nextMonth.toISOString() })
                        .eq('id', userId);

                    if (error) throw error;

                    useNotificationStore.getState().show(`Premium concedido para @${username}!`, 'success');
                    setSearchQuery('');
                    setSearchResults([]);
                    fetchSubscribers();
                } catch (err: any) {
                    useNotificationStore.getState().show(err.message, 'error');
                } finally {
                    setIsUpdating(false);
                }
            }
        });
    };

    const revokePremium = async (userId: string, username: string) => {
        if (!isMaster) return;

        useNotificationStore.getState().confirm({
            title: "Remover Premium",
            message: `Deseja remover a assinatura de @${username}?`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ subscription_end_date: null })
                        .eq('id', userId);

                    if (error) throw error;

                    useNotificationStore.getState().show(`Premium removido de @${username}`, 'info');
                    fetchSubscribers();
                } catch (err: any) {
                    useNotificationStore.getState().show(err.message, 'error');
                } finally {
                    setIsUpdating(false);
                }
            }
        });
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dark">
            <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 flex items-center justify-between">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <div className="flex flex-col items-center text-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">Assinaturas</h2>
                    <p className="text-sm font-black italic uppercase">Gestão de Assinantes</p>
                </div>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-10 pb-32">
                {/* Search Player Section */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Conceder Premium (Busca)</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Nome ou E-mail do jogador..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:border-yellow-500/50 transition-all"
                        />
                        <button
                            onClick={handleSearch}
                            className="w-14 h-14 bg-yellow-500 text-black rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined font-black">search</span>
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden divide-y divide-white/5">
                            {searchResults.map(p => (
                                <div key={p.id} className="p-4 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-white/5 overflow-hidden">
                                            <img src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xs italic">@{p.username}</p>
                                            <p className="text-[9px] text-white/40 uppercase font-bold">{p.email || '---'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => grantPremium(p.id, p.username)}
                                        className="bg-yellow-500 text-black text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest"
                                    >
                                        Dar Premium
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Subscribers List Section */}
                <section className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1 flex items-center justify-between">
                        <span>Assinantes Ativos</span>
                        <span className="bg-white/5 px-2 py-0.5 rounded-full text-[9px]">{subscribers.length} total</span>
                    </h3>

                    {isLoading && subscribers.length === 0 ? (
                        <div className="py-20 text-center opacity-20">
                            <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
                        </div>
                    ) : subscribers.length === 0 ? (
                        <div className="py-20 text-center opacity-20">
                            <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum assinante encontrado</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {subscribers.map(sub => {
                                const exp = new Date(sub.subscription_end_date);
                                const isExpired = exp < new Date();
                                return (
                                    <div key={sub.id} className={`bg-stone-950/50 border rounded-[2rem] p-5 flex items-center justify-between ${isExpired ? 'border-red-500/20 opacity-50' : 'border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="size-14 rounded-2xl border border-white/5 overflow-hidden">
                                                <img src={sub.avatar_url || 'https://images.unsplash.com/photo-1510227272981-87123e259b17?q=80&w=100'} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="font-black italic text-sm text-white">{sub.username}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={`material-symbols-outlined text-[12px] ${isExpired ? 'text-red-500' : 'text-yellow-500'}`}>event</span>
                                                    <p className={`text-[10px] font-black uppercase ${isExpired ? 'text-red-500' : 'text-white/40'}`}>
                                                        Expira: {exp.toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => revokePremium(sub.id, sub.username)}
                                            className="size-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20 active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-xl">person_remove</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};
