
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';
import { AppScreen } from '../types';

interface Props {
    onBack: () => void;
    onNavigate: (screen: AppScreen) => void;
}

export const MasterHubScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
    const { profile, refreshProfile, isMaster, isEditMode, setEditMode } = useUserStore();
    const [isUpdating, setIsUpdating] = useState(false);
    const [appSettings, setAppSettings] = useState<any>(null);

    const [adminTimeLeft, setAdminTimeLeft] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        fetchData();
        const timer = setInterval(calculateTimeLeft, 1000);
        // Chama imediatamente após montar ou atualizar appSettings
        calculateTimeLeft();
        return () => clearInterval(timer);
    }, [appSettings]);

    const fetchData = async () => {
        await refreshProfile();
        const { data: settings } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
        if (settings) setAppSettings(settings);
    };

    const calculateTimeLeft = () => {
        if (!appSettings || appSettings.bpoints_reset_mode === 'manual') {
            setAdminTimeLeft('');
            return;
        }

        const now = new Date();
        const spOffset = -3;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const spNow = new Date(utc + (3600000 * spOffset));

        let targetDate = new Date(spNow);

        if (appSettings.bpoints_reset_mode === 'teste') {
            const lastReset = appSettings.last_bpoints_reset ? new Date(appSettings.last_bpoints_reset) : new Date();
            targetDate = new Date(lastReset.getTime() + 15000);
        } else if (appSettings.bpoints_reset_mode === 'daily') {
            targetDate.setHours(24, 0, 0, 0);
        } else if (appSettings.bpoints_reset_mode === 'weekly') {
            const day = spNow.getDay();
            const diff = day === 0 ? 1 : (8 - day);
            targetDate.setDate(spNow.getDate() + diff);
            targetDate.setHours(0, 0, 0, 0);
        } else if (appSettings.bpoints_reset_mode === 'biweekly') {
            const dayOfMonth = spNow.getDate();
            if (dayOfMonth < 16) {
                targetDate.setDate(16);
                targetDate.setHours(0, 0, 0, 0);
            } else {
                targetDate.setMonth(spNow.getMonth() + 1);
                targetDate.setDate(1);
                targetDate.setHours(0, 0, 0, 0);
            }
        } else if (appSettings.bpoints_reset_mode === 'monthly') {
            targetDate = new Date(spNow.getFullYear(), spNow.getMonth() + 1, 1, 0, 0, 0);
        } else {
            setAdminTimeLeft('');
            return;
        }

        const msLeft = targetDate.getTime() - spNow.getTime();
        if (msLeft < 0) {
            setAdminTimeLeft('Resetando...');
            if (!isResetting) {
                setIsResetting(true);
                supabase.rpc('reset_all_bpoints').then(({ error }) => {
                    if (!error) {
                        fetchData();
                        setTimeout(() => setIsResetting(false), 2000);
                    } else {
                        setIsResetting(false);
                    }
                });
            }
            return;
        }

        const d = Math.floor(msLeft / (1000 * 60 * 60 * 24));
        const h = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
        const m = Math.floor((msLeft / (1000 * 60)) % 60);
        const s = Math.floor((msLeft / 1000) % 60);

        if (d > 0) setAdminTimeLeft(`${d}d ${h}h ${m}m`);
        else setAdminTimeLeft(`${h}h ${m}m ${s}s`);
    };

    const handleManualReset = async () => {
        useNotificationStore.getState().confirm({
            title: "Zerar todos os BPoints?",
            message: "Tem certeza? Isso resetará a pontuação de TODOS os jogadores para zero.",
            onConfirm: async () => {
                setIsResetting(true);
                try {
                    const { error } = await supabase.rpc('reset_all_bpoints');
                    if (!error) {
                        useNotificationStore.getState().show("Sucesso! Todos os BPoints foram resetados.", 'success');
                        fetchData();
                    } else {
                        useNotificationStore.getState().show("Falha no Reset Global via RPC.", 'error');
                    }
                } catch (err) {
                    useNotificationStore.getState().show("Erro inesperado.", 'error');
                } finally {
                    setIsResetting(false);
                }
            }
        });
    };

    const handleUpdateResetMode = async (mode: string) => {
        if (!appSettings?.id) return;
        const { error } = await supabase.from('app_settings').update({ bpoints_reset_mode: mode }).eq('id', appSettings.id);
        if (!error) {
            setAppSettings({ ...appSettings, bpoints_reset_mode: mode });
            useNotificationStore.getState().show(`Ciclo alterado para: ${mode}`, 'success');
        }
    };

    const addTestCoins = async () => {
        if (isUpdating || !profile || !isMaster) return;
        setIsUpdating(true);

        const newBalance = (profile.bcoins || 0) + 100;
        const { error } = await supabase
            .from('profiles')
            .update({ bcoins: newBalance })
            .eq('id', profile.id);

        if (!error) {
            await refreshProfile();
            useNotificationStore.getState().show('BCOINS de teste adicionados!', 'success');
        }
        setIsUpdating(false);
    };

    const menuItems = [
        {
            id: 'store_admin',
            title: 'Gerenciamento da Loja',
            icon: 'storefront',
            desc: 'Produtos, Cupons e Promoções Globais',
            action: () => onNavigate('store_admin'),
            color: 'text-primary'
        },
        {
            id: 'sub_admin',
            title: 'Gestão de Assinaturas',
            icon: 'card_membership',
            desc: 'Assinantes, Prazos e Concessão Premium',
            action: () => onNavigate('sub_admin'),
            color: 'text-yellow-500'
        },
        {
            id: 'players',
            title: 'Gestão de Jogadores',
            icon: 'group',
            desc: 'Buscar, Saldo e Perfis de Usuários',
            action: () => onNavigate('player_management'),
            color: 'text-blue-500'
        },
        {
            id: 'transactions',
            title: 'Extrato de Movimentações',
            icon: 'history_edu',
            desc: 'Log de todas as transações de BCOINS',
            action: () => onNavigate('transaction_logs'),
            color: 'text-emerald-500'
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background-dark">
            <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 flex items-center justify-between">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <div className="flex flex-col items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Master Panel</h2>
                    <p className="text-sm font-black italic uppercase">Configurações Gerais</p>
                </div>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-10 pb-32">
                {/* MODO EDIÇÃO TOGGLE */}
                <div className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between ${isEditMode ? 'bg-primary/10 border-primary shadow-[0_0_30px_rgba(255,193,7,0.1)]' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isEditMode ? 'bg-primary text-black' : 'bg-white/10 text-white/40'}`}>
                            <span className="material-symbols-outlined text-2xl">edit_note</span>
                        </div>
                        <div>
                            <h3 className="font-black italic uppercase text-sm leading-tight">Modo Edição de UI</h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-tight">
                                {isEditMode ? 'Clique em qualquer botão para editar' : 'Edite textos de botões e cores'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setEditMode(!isEditMode)}
                        className={`w-14 h-8 rounded-full relative transition-colors ${isEditMode ? 'bg-primary' : 'bg-white/20'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${isEditMode ? (isEditMode ? 'left-7' : 'left-1') : 'left-1'}`} />
                    </button>
                </div>

                <section className="grid grid-cols-1 gap-4">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className="bg-white/5 border border-white/10 p-5 rounded-[2rem] flex items-center gap-5 active:scale-[0.98] transition-all text-left"
                        >
                            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${item.color}`}>
                                <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black italic uppercase text-sm leading-tight mb-1">{item.title}</h3>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-tight">{item.desc}</p>
                            </div>
                            <span className="material-symbols-outlined text-white/20">chevron_right</span>
                        </button>
                    ))}
                </section>

                {/* BPOINTS RESET PANEL */}
                <section className="bg-stone-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">history</span>
                            <h3 className="font-black italic uppercase text-sm">Próximo Reset Automático</h3>
                        </div>
                        {adminTimeLeft && (
                            <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
                                RESET EM: {adminTimeLeft}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'teste', label: 'Teste (15s)' },
                            { id: 'manual', label: 'Manual' },
                            { id: 'daily', label: 'Diário' },
                            { id: 'weekly', label: 'Semanal' },
                            { id: 'biweekly', label: 'Quinzenal' },
                            { id: 'monthly', label: 'Mensal' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => handleUpdateResetMode(mode.id)}
                                className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-widest border transition-all ${appSettings?.bpoints_reset_mode === mode.id ? 'bg-green-500 text-black border-green-500' : 'bg-white/5 text-white/40 border-white/10'}`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleManualReset}
                        disabled={isResetting}
                        className="w-full h-14 bg-red-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {isResetting ? 'PROCESSANDO...' : 'ZERAR TODOS OS BPOINTS AGORA'}
                    </button>
                </section>

                <section className="pt-4 space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Ações Rápidas de Admin</h3>
                    <button
                        onClick={addTestCoins}
                        disabled={isUpdating}
                        className="w-full bg-primary/10 border border-primary/20 rounded-[2rem] p-6 flex items-center justify-between active:scale-95 transition-all text-left group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-primary text-black rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-3xl">{isUpdating ? 'sync' : 'add_card'}</span>
                            </div>
                            <div>
                                <h4 className="font-black italic uppercase text-sm text-primary">Recarga de Teste</h4>
                                <p className="text-[10px] font-bold text-primary/60 uppercase">Adicionar +100 BCOINS na sua conta</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-primary/40">rocket_launch</span>
                    </button>
                </section>
            </main>
        </div>
    );
};
