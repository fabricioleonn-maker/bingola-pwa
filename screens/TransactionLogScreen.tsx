
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';

interface Props {
    onBack: () => void;
}

export const TransactionLogScreen: React.FC<Props> = ({ onBack }) => {
    const { isMaster } = useUserStore();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isMaster) fetchTransactions();
    }, [isMaster]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('bcoins_transactions')
            .select('*, profiles:user_id(username)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            useNotificationStore.getState().show("Erro ao carregar logs: " + error.message, 'error');
        } else {
            setTransactions(data || []);
        }
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dark text-white">
            <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 flex items-center justify-between">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <div className="flex flex-col items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Financeiro</h2>
                    <p className="text-sm font-black italic uppercase">Extrato Geral</p>
                </div>
                <button onClick={fetchTransactions} className="w-10 h-10 flex items-center justify-center text-emerald-500">
                    <span className="material-symbols-outlined">refresh</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-4 pb-32">
                {isLoading ? (
                    <div className="h-40 flex items-center justify-center opacity-20">
                        <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-white/20 space-y-4">
                        <span className="material-symbols-outlined text-6xl">receipt_long</span>
                        <p className="font-black uppercase tracking-widest text-xs">Sem transações registradas</p>
                    </div>
                ) : (
                    transactions.map(tx => (
                        <div key={tx.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                                    @{tx.profiles?.username || 'Sistema'}
                                </p>
                                <p className="text-xs font-bold text-white/80">{tx.reason || 'Ajuste de Saldo'}</p>
                                <p className="text-[8px] text-white/20 uppercase font-black">
                                    {new Date(tx.created_at).toLocaleString('pt-BR')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`text-lg font-black ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </p>
                                <p className="text-[8px] font-black text-white/10 uppercase">{tx.type}</p>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};
