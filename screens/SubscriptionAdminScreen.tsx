
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';

interface Subscriber {
    id: string;
    username: string;
    email: string;
    subscription_end_date: string | null;
    avatar_url: string | null;
    is_lifetime_premium?: boolean;
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
        fetchInitialPlayers();
    }, []);

    const fetchInitialPlayers = async () => {
        // Load initial batch of players for browsing
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, subscription_end_date, avatar_url, is_lifetime_premium')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!error && data) {
            setSearchResults(data);
        }
    };

    const fetchSubscribers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, subscription_end_date, avatar_url, is_lifetime_premium')
            .or('subscription_end_date.not.is.null,is_lifetime_premium.eq.true')
            .order('subscription_end_date', { ascending: false });

        if (!error && data) {
            setSubscribers(data as Subscriber[]);
        }
        setIsLoading(false);
    };

    const handleSearch = async () => {
        // If empty, revert to initial list
        if (!searchQuery.trim()) {
            fetchInitialPlayers();
            return;
        }

        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, subscription_end_date, avatar_url, is_lifetime_premium')
            .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
            .limit(20);

        if (!error && data) {
            setSearchResults(data);
        }
        setIsLoading(false);
    };

    const grantPremium = async (userId: string, username: string) => {
        if (!isMaster) return;

        useNotificationStore.getState().confirm({
            title: "Dar Assinatura Mensal",
            message: `Deseja conceder 30 dias de Premium para @${username}?`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const nextMonth = new Date();
                    nextMonth.setDate(nextMonth.getDate() + 30);

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            subscription_end_date: nextMonth.toISOString(),
                            is_lifetime_premium: false
                        })
                        .eq('id', userId);

                    if (error) throw error;

                    useNotificationStore.getState().show(`Mensal concedido para @${username}!`, 'success');
                    fetchSubscribers();
                    // Update list item locally to reflect change immediately
                    setSearchResults(prev => prev.map(p => p.id === userId ? { ...p, subscription_end_date: nextMonth.toISOString(), is_lifetime_premium: false } : p));
                } catch (err: any) {
                    useNotificationStore.getState().show(err.message, 'error');
                } finally {
                    setIsUpdating(false);
                }
            }
        });
    };

    const grantLifetime = async (userId: string, username: string) => {
        if (!isMaster) return;

        useNotificationStore.getState().confirm({
            title: "Dar Assinatura VITALÍCIA",
            message: `Tem certeza? @${username} terá acesso Premium para sempre.`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            is_lifetime_premium: true,
                            subscription_end_date: null // Clear date since it's lifetime
                        })
                        .eq('id', userId);

                    if (error) throw error;

                    useNotificationStore.getState().show(`VITALÍCIO concedido para @${username}!`, 'success');
                    fetchSubscribers();
                    setSearchResults(prev => prev.map(p => p.id === userId ? { ...p, is_lifetime_premium: true, subscription_end_date: null } : p));
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
            message: `Deseja remover TOTALMENTE a assinatura de @${username}?`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            subscription_end_date: null,
                            is_lifetime_premium: false
                        })
                        .eq('id', userId);

                    if (error) throw error;

                    useNotificationStore.getState().show(`Premium removido de @${username}`, 'info');
                    fetchSubscribers();
                    setSearchResults(prev => prev.map(p => p.id === userId ? { ...p, is_lifetime_premium: false, subscription_end_date: null } : p));
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
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Gerenciar Jogadores</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Buscar por nome ou e-mail..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:border-yellow-500/50 transition-all"
                        />
                        <button
                            onClick={handleSearch}
                            className="w-14 h-14 bg-yellow-500 text-black rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined font-black">search</span>
                        </button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden divide-y divide-white/5">
                        {searchResults.length === 0 ? (
                            <div className="p-8 text-center text-white/20 text-[10px] uppercase font-bold">
                                Nenhum jogador encontrado
                            </div>
                        ) : (
                            searchResults.map(p => (
                                <div key={p.id} className="p-4 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-white/5 overflow-hidden">
                                            <img src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xs italic flex items-center gap-1">
                                                @{p.username}
                                                {p.is_lifetime_premium && <span className="text-[8px] bg-purple-500 text-white px-1.5 rounded uppercase">Vitalício</span>}
                                            </p>
                                            <p className="text-[9px] text-white/40 uppercase font-bold">{p.email || '---'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => grantPremium(p.id, p.username)}
                                            className="bg-white/10 text-white text-[9px] font-black px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-white/20"
                                        >
                                            30d
                                        </button>
                                        <button
                                            onClick={() => grantLifetime(p.id, p.username)}
                                            className="bg-purple-600 text-white text-[9px] font-black px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-purple-500"
                                        >
                                            Vitalício
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
                                const isLifetime = sub.is_lifetime_premium;
                                const exp = sub.subscription_end_date ? new Date(sub.subscription_end_date) : null;
                                const isExpired = !isLifetime && exp && exp < new Date();

                                return (
                                    <div key={sub.id} className={`bg-stone-950/50 border rounded-[2rem] p-5 flex flex-col gap-4 ${isExpired ? 'border-red-500/20 opacity-50' : isLifetime ? 'border-purple-500/30 bg-purple-500/5 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-yellow-500/20'}`}>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-4">
                                                <div className="size-14 rounded-2xl border border-white/5 overflow-hidden">
                                                    <img src={sub.avatar_url || 'https://images.unsplash.com/photo-1510227272981-87123e259b17?q=80&w=100'} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black italic text-sm text-white">{sub.username}</p>
                                                        {isLifetime && (
                                                            <span className="bg-purple-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shadow-lg shadow-purple-500/20">
                                                                Vitalício
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`material-symbols-outlined text-[12px] ${isExpired ? 'text-red-500' : isLifetime ? 'text-purple-500' : 'text-yellow-500'}`}>
                                                            {isLifetime ? 'verified' : 'event'}
                                                        </span>
                                                        <p className={`text-[10px] font-black uppercase ${isExpired ? 'text-red-500' : 'text-white/40'}`}>
                                                            {isLifetime ? 'Acesso Permanente' : exp ? `Expira: ${exp.toLocaleDateString('pt-BR')}` : '---'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons for Subscribers */}
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                                            {!isLifetime && (
                                                <button
                                                    onClick={() => grantLifetime(sub.id, sub.username)}
                                                    className="bg-purple-500/20 text-purple-400 text-[9px] font-black px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-purple-500/30"
                                                >
                                                    Upgrade Vitalício
                                                </button>
                                            )}
                                            <button
                                                onClick={() => revokePremium(sub.id, sub.username)}
                                                className="bg-red-500/10 text-red-500 text-[9px] font-black px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-red-500/20 flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">person_remove</span>
                                                Remover
                                            </button>
                                        </div>
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
