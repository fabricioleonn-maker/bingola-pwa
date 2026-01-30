
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';

interface Props {
    onBack: () => void;
}

export const PlayerManagementScreen: React.FC<Props> = ({ onBack }) => {
    const { profile: masterProfile, isMaster } = useUserStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !isMaster) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`)
            .limit(10);

        if (error) {
            useNotificationStore.getState().show("Erro na busca: " + error.message, 'error');
        } else {
            setSearchResults(data || []);
            if (data?.length === 0) {
                useNotificationStore.getState().show("Nenhum jogador encontrado", 'info');
            }
        }
    };

    const updateBCOINS = async (type: 'gift' | 'withdraw') => {
        if (!selectedPlayer || !amount || !isMaster) return;
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) {
            useNotificationStore.getState().show("Valor inválido", 'error');
            return;
        }

        const finalAmount = type === 'gift' ? val : -val;
        setIsUpdating(true);

        try {
            // 1. Update Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ bcoins: (selectedPlayer.bcoins || 0) + finalAmount })
                .eq('id', selectedPlayer.id);

            if (profileError) throw profileError;

            // 2. Record Transaction
            await supabase.from('bcoins_transactions').insert({
                user_id: selectedPlayer.id,
                master_id: masterProfile!.id,
                amount: finalAmount,
                type: type,
                reason: type === 'gift' ? 'Ajuste Master (+)' : 'Ajuste Master (-)'
            });

            useNotificationStore.getState().show(
                `Sucesso: ${type === 'gift' ? 'Adicionado' : 'Removido'} ${val} BCOINS para @${selectedPlayer.username}`,
                'success'
            );

            // Refresh local selected player state
            setSelectedPlayer({ ...selectedPlayer, bcoins: (selectedPlayer.bcoins || 0) + finalAmount });
            setAmount('');
        } catch (err: any) {
            useNotificationStore.getState().show("Falha: " + err.message, 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const resetBPoints = async () => {
        if (!selectedPlayer || !isMaster) return;

        useNotificationStore.getState().confirm({
            title: "Resetar BPoints?",
            message: `Deseja zerar a pontuação de @${selectedPlayer.username}?`,
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ bpoints: 0 })
                        .eq('id', selectedPlayer.id);

                    if (error) throw error;

                    useNotificationStore.getState().show(`BPoints de @${selectedPlayer.username} resetados!`, 'success');
                    setSelectedPlayer({ ...selectedPlayer, bpoints: 0 });
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
                <div className="flex flex-col items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Jogadores</h2>
                    <p className="text-sm font-black italic uppercase">Gestão de Perfis</p>
                </div>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32">
                {/* Search Section */}
                <section className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Username ou Email..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-blue-500/50"
                        />
                        <button
                            onClick={handleSearch}
                            className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined font-black">search</span>
                        </button>
                    </div>

                    {searchResults.length > 0 && !selectedPlayer && (
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden divide-y divide-white/5 animate-in fade-in slide-in-from-top-2">
                            {searchResults.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPlayer(p)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-white/5 border border-white/5 overflow-hidden">
                                            {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-white/20 m-2">person</span>}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs uppercase italic">@{p.username}</p>
                                            <p className="text-[9px] text-white/30 font-bold uppercase">{p.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-primary uppercase">B$ {p.bcoins || 0}</p>
                                        <p className="text-[10px] font-black text-green-500 uppercase">{p.bpoints || 0} pts</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* Management Panel */}
                {selectedPlayer && (
                    <section className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 relative overflow-hidden">
                            <button
                                onClick={() => setSelectedPlayer(null)}
                                className="absolute top-4 right-4 text-white/20 hover:text-white"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>

                            <div className="flex flex-col items-center mb-6">
                                <div className="size-20 rounded-3xl border-2 border-blue-500/30 p-1 mb-3">
                                    <img src={selectedPlayer.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="w-full h-full rounded-2xl object-cover" />
                                </div>
                                <h3 className="text-xl font-black italic uppercase text-white">@{selectedPlayer.username}</h3>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{selectedPlayer.email}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-black/20 p-4 rounded-3xl text-center">
                                    <p className="text-[9px] font-black text-white/20 uppercase mb-1">Saldo Atual</p>
                                    <p className="text-lg font-black text-primary">B$ {selectedPlayer.bcoins || 0}</p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-3xl text-center">
                                    <p className="text-[9px] font-black text-white/20 uppercase mb-1">Pontuação</p>
                                    <p className="text-lg font-black text-green-500">{selectedPlayer.bpoints || 0}</p>
                                </div>
                            </div>

                            {/* BCOINS Control */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest px-2">Ajustar BCOINS</p>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Qtd..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 text-lg font-black text-primary outline-none focus:border-primary/50"
                                    />
                                    <button
                                        onClick={() => updateBCOINS('withdraw')}
                                        disabled={isUpdating}
                                        className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined font-black text-3xl">remove</span>
                                    </button>
                                    <button
                                        onClick={() => updateBCOINS('gift')}
                                        disabled={isUpdating}
                                        className="w-14 h-14 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined font-black text-3xl">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* BPOINTS Control */}
                            <div className="pt-8 space-y-3">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest px-2">Ações de Perigo</p>
                                <button
                                    onClick={resetBPoints}
                                    disabled={isUpdating}
                                    className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">history</span>
                                    Zerar BPoints do Jogador
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};
