
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const { profile, refreshProfile } = useUserStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [appSettings, setAppSettings] = useState<any>(null);

  const [adminTimeLeft, setAdminTimeLeft] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Master Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [showExtrato, setShowExtrato] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchProfileData = async () => {
    await refreshProfile();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Always fetch app settings for cycle display/countdown
    try {
      const { data: settings } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (settings) setAppSettings(settings);
    } catch (e) {
      console.warn("Could not fetch app settings:", e);
    }

    if (authUser) {
      if (authUser.email?.toLowerCase() === 'fabricio.leonn@gmail.com') {
        setIsMaster(true);
      }
      if (profile) {
        setNewName(profile.username || '');
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!appSettings || appSettings.bpoints_reset_mode === 'manual' || !isMaster) {
        setAdminTimeLeft('');
        return;
      }

      const now = new Date();
      // SP Timezone (UTC-3)
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
        // TRIGGER AUTO RESET (First client to hit this window calls RPC)
        if (appSettings.bpoints_reset_mode !== 'manual' && !isResetting) {
          setIsResetting(true);
          console.log("[Admin] Auto-triggering global reset...");
          supabase.rpc('reset_all_bpoints').then(({ error }) => {
            if (!error) {
              console.log("[Admin] Global reset successful.");
              fetchProfileData();
              setTimeout(() => setIsResetting(false), 2000);
            } else {
              console.error("[Admin] Auto-reset failed:", error);
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

      if (d > 0) {
        setAdminTimeLeft(`${d}d ${h}h ${m}m`);
      } else {
        setAdminTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();
    return () => clearInterval(timer);
  }, [appSettings, isMaster]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate('login');
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim() || !profile) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newName })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      useNotificationStore.getState().show('Perfil atualizado!', 'success');
    } catch (err: any) {
      useNotificationStore.getState().show(err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !profile) return;
    const { error } = await supabase.auth.resetPasswordForEmail(authUser.email!, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) useNotificationStore.getState().show(error.message, 'error');
    else useNotificationStore.getState().show('E-mail de redefinição de senha enviado!', 'info');
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update profile table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      useNotificationStore.getState().show('Foto de perfil atualizada com sucesso!', 'success');
    } catch (error: any) {
      useNotificationStore.getState().show(error.message, 'error');
    } finally {
      setUploading(false);
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

    setTimeout(() => setIsUpdating(false), 1000);
  };

  const handleManualReset = async () => {
    if (!isMaster) return;
    useNotificationStore.getState().confirm({
      title: "Zerar todos os BPoints?",
      message: "Tem certeza? Isso resetará a pontuação de TODOS os jogadores para zero. ESSA AÇÃO REQUER A FUNÇÃO RPC 'reset_all_bpoints' NO SUPABASE.",
      onConfirm: async () => {
        setIsUpdating(true);
        try {
          // Use RPC for global reset to bypass RLS
          const { error } = await supabase.rpc('reset_all_bpoints');

          if (!error) {
            useNotificationStore.getState().show("Todos os BPoints foram resetados!", 'success');
            fetchProfileData();
          } else {
            console.error("RPC Error:", error);
            useNotificationStore.getState().show("Falha no Reset Global. Verifique se a função RPC V3 foi criada no Supabase.", 'error');
          }
        } catch (err) {
          console.error("Reset exception:", err);
          useNotificationStore.getState().show("Erro inesperado ao resetar.", 'error');
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const handleUpdateResetMode = async (mode: string) => {
    if (!isMaster || !appSettings?.id) return;
    const { error } = await supabase.from('app_settings').update({ bpoints_reset_mode: mode }).eq('id', appSettings.id);
    if (!error) {
      setAppSettings({ ...appSettings, bpoints_reset_mode: mode });
      useNotificationStore.getState().show(`Ciclo de reset alterado para: ${mode}`, 'success');
    }
  };

  const fetchTransactions = async () => {
    if (!isMaster) return;
    const { data, error } = await supabase
      .from('bcoins_transactions')
      .select('*, profiles:user_id(username)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
      return;
    }
    setTransactions(data || []);
  };

  const handleSearchPlayer = async () => {
    if (!searchQuery.trim() || !isMaster) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .limit(5);
    setSearchResults(data || []);
  };

  const handleManageBCoins = async (type: 'gift' | 'withdraw') => {
    if (!selectedPlayer || !giftAmount || !isMaster) return;
    const amount = parseInt(giftAmount);
    if (isNaN(amount) || amount <= 0) return;

    const finalAmount = type === 'gift' ? amount : -amount;
    setIsUpdating(true);

    try {
      // 1. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ bcoins: (selectedPlayer.bcoins || 0) + finalAmount })
        .eq('id', selectedPlayer.id);

      if (profileError) throw profileError;

      // 2. Record Transaction
      const { error: txError } = await supabase.from('bcoins_transactions').insert({
        user_id: selectedPlayer.id,
        master_id: profile!.id,
        amount: finalAmount,
        type: type,
        reason: type === 'gift' ? 'Presente Master' : 'Retirada Master'
      });

      if (txError) {
        console.error("TX Error:", txError);
        // Don't throw, balance was updated, but extrato might be missing
      }

      useNotificationStore.getState().show(
        `Sucesso: ${type === 'gift' ? 'Enviado' : 'Retirado'} ${amount} BCOINS para @${selectedPlayer.username}`,
        'success'
      );

      setSelectedPlayer(null);
      setGiftAmount('');
      setSearchQuery('');
      setSearchResults([]);
      fetchTransactions();
    } catch (err: any) {
      useNotificationStore.getState().show("Erro na gestão: " + err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    useNotificationStore.getState().show(`${label} copiado!`, 'success');
  };

  const shareReferral = () => {
    if (!profile?.referral_code) return;
    const text = `Vem jogar Bingola comigo! 🎱\nUse meu código de indicação: ${profile.referral_code}\n\nGanhe bônus na sua primeira compra! 🎁✨`;

    if (navigator.share) {
      navigator.share({ title: 'Bingola', text, url: window.location.origin });
    } else {
      copyToClipboard(profile!.referral_code, "Código");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Configurações</h2>
        <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center text-red-500">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="flex flex-col items-center py-10">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full border-4 border-primary p-1 shadow-2xl shadow-primary/10 overflow-hidden relative group">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="User Profile" />
              ) : (
                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-white/20">person</span>
                </div>
              )}

              <label
                htmlFor="avatar-upload"
                className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                    <span className="text-[8px] font-black text-white mt-1 uppercase">Trocar</span>
                  </>
                )}
              </label>
              <input
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={uploading}
              />
            </div>
            <div className="absolute bottom-1 right-1 bg-primary text-black font-black text-[10px] px-3 py-1 rounded-full border-2 border-background-dark">
              LVL {profile?.level || 1}
            </div>
          </div>
          {isEditing ? (
            <div className="w-full max-w-[280px] space-y-4 flex flex-col items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-black outline-none focus:border-primary/50 text-white"
                placeholder="Novo nome"
              />
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-[10px] font-black uppercase text-white/40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  className="flex-1 py-3 rounded-xl bg-primary text-[10px] font-black uppercase text-white shadow-lg shadow-primary/20"
                >
                  {isUpdating ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center group cursor-pointer" onClick={() => setIsEditing(true)}>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                @{profile?.username || 'Explorador'}
                <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-colors text-xl">edit</span>
              </h1>
              <p className="text-white/40 text-sm mt-1">{profile?.email || 'Visitante'}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
            <span className="material-symbols-outlined text-primary text-3xl mb-3">account_balance_wallet</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Saldo BCOINS</p>
            <p className="text-xl font-black mt-1 text-white">B$ {profile?.bcoins || 0}</p>
          </div>
          <div className="bg-surface-dark p-5 rounded-3xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 blur-2xl"></div>
            <span className="material-symbols-outlined text-3xl mb-3 text-green-500">military_tech</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">BPOINTS (Ranking)</p>
            <p className="text-xl font-black mt-1 text-green-500">{profile?.bpoints || 0}</p>
          </div>
        </div>

        {/* Referral Card */}
        <div className="bg-gradient-to-br from-primary/20 to-purple-500/10 border border-white/10 rounded-[2.5rem] p-6 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mr-16 -mt-16 animate-pulse"></div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Seu Código de Indicação</p>
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">{profile?.referral_code || '------'}</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(profile?.referral_code || '', "Código")}
                className="size-14 bg-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
                title="Copiar Código"
              >
                <span className="material-symbols-outlined font-black">content_copy</span>
              </button>
              <button
                onClick={shareReferral}
                className="size-14 bg-primary text-black rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="Compartilhar"
              >
                <span className="material-symbols-outlined font-black">share</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Convide amigos e ganhe 10 BCOINS quando eles usarem seu código na primeira compra! Eles ganham 10% de desconto!
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Segurança e Dados</h3>

          <button
            onClick={handleChangePassword}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-500">lock_reset</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Alterar Senha</p>
                <p className="text-[10px] text-white/40">Enviar link de redefinição para e-mail</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-white/20">chevron_right</span>
          </button>

          <button
            id="personalize-btn"
            onClick={() => onNavigate('customization')}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-500">style</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Customização</p>
                <p className="text-[10px] text-white/40">Estilos de cartela e animações</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-white/20">chevron_right</span>
          </button>

          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1 pt-4">Legal</h3>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] text-white/40 font-bold uppercase text-center leading-relaxed">
            Bingola BETA - 2026<br />
            VOKE - Todos os direitos reservados
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-3 px-6 z-50">
        <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">home</span>
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button onClick={() => onNavigate('ranking')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">leaderboard</span>
          <span className="text-[10px] font-bold">Ranking</span>
        </button>
        <button onClick={() => onNavigate('friends')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">group</span>
          <span className="text-[10px] font-bold">Social</span>
        </button>
        <button onClick={() => onNavigate('store')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-[10px] font-bold">Loja</span>
        </button>
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined fill-1">person</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>

      {/* Extrato Modal */}
      {showExtrato && (
        <div className="fixed inset-0 z-[300] bg-background-dark/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <header
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
            className="p-4 border-b border-white/5 flex items-center justify-between"
          >
            <button onClick={() => setShowExtrato(false)} className="w-10 h-10 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
            <h3 className="font-black italic uppercase tracking-widest text-sm">Extrato Geral</h3>
            <div className="w-10"></div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 space-y-4">
            {transactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                <span className="material-symbols-outlined text-6xl">receipt_long</span>
                <p className="font-black uppercase tracking-widest text-xs">Nenhuma movimentação</p>
              </div>
            ) : transactions.map(tx => (
              <div key={tx.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">@{tx.profiles?.username || 'user'}</p>
                  <p className="text-xs font-bold text-white/60">{tx.reason || 'Movimentação'}</p>
                  <p className="text-[8px] text-white/20 uppercase font-black">{new Date(tx.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className={`text-lg font-black ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))}
          </main>
        </div>
      )}
    </div>
  );
};
