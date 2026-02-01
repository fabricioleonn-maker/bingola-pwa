
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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

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
        setNewName(profile.full_name || profile.username || '');
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  // ... (keep useEffect for timer) ...

  const handleUpdateProfile = async () => {
    if (!newName.trim() || !profile) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName }) // Update full_name, NOT username
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      useNotificationStore.getState().show('Nome atualizado!', 'success');
    } catch (err: any) {
      useNotificationStore.getState().show(err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      useNotificationStore.getState().show(`${label} copiado!`, 'success');
    } catch (error) {
      useNotificationStore.getState().show('Erro ao copiar', 'error');
    }
  };

  const shareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bingola',
          text: `Use meu código ${profile?.referral_code} e ganhe bônus!`,
          url: 'https://bingola.app',
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      copyToClipboard(profile?.referral_code || '', "Código");
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      useNotificationStore.getState().show('Senha deve ter min. 6 caracteres', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      useNotificationStore.getState().show('Senhas não conferem', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      useNotificationStore.getState().show('Senha atualizada!', 'success');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      useNotificationStore.getState().show(error.message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangePassword = async () => {
    if (!profile?.email) return;
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      useNotificationStore.getState().show('Email de redefinição enviado!', 'success');
    } catch (error: any) {
      useNotificationStore.getState().show(error.message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error: any) {
      useNotificationStore.getState().show('Erro ao excluir conta: ' + error.message, 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark text-white font-sans overflow-hidden">
      <header className="p-4 pt-8 flex items-center justify-between px-6">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-white/60">arrow_back</span>
        </button>
        <h2 className="text-sm font-black uppercase tracking-widest text-white/40">Meu Perfil</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 pb-32 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-28 h-28 rounded-full border-4 border-primary p-1 mb-4 relative group cursor-pointer">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full rounded-full bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white/20">person</span>
              </div>
            )}
            <button className="absolute bottom-1 right-1 bg-primary text-black rounded-full p-2 hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-sm font-black">photo_camera</span>
            </button>
          </div>

          {isEditing ? (
            <div className="w-full max-w-[280px] space-y-4 flex flex-col items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-black outline-none focus:border-primary/50 text-white"
                placeholder="Seu Nome de Exibição"
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
                  {isUpdating ? 'Salvando...' : 'Salvar Nome'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center group cursor-pointer" onClick={() => setIsEditing(true)}>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                {profile?.full_name || `@${profile?.username}` || 'Explorador'}
                <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-colors text-xl">edit</span>
              </h1>
              {profile?.full_name && <p className="text-white/40 text-xs font-bold uppercase mb-1">@{profile.username}</p>}
              <p className="text-white/40 text-sm mt-1">{profile?.email || 'Visitante'}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
            <span className="material-symbols-outlined text-primary text-3xl mb-3">account_balance_wallet</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Saldo BCOINS</p>
            <div className="flex items-center justify-between">
              <p className="text-xl font-black mt-1 text-white">B$ {profile?.bcoins || 0}</p>
              <button onClick={() => setShowExtrato(true)} className="text-[10px] font-bold text-primary/60 hover:text-primary">EXTRATO</button>
            </div>
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
            onClick={() => setShowPasswordModal(true)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-500">lock_reset</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Alterar Senha</p>
                <p className="text-[10px] text-white/40">Definir nova senha agora</p>
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

          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1 pt-4">Termos e Legal</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <a
              href="/legal/privacy-policy.html"
              target="_blank"
              className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center active:scale-95 transition-all"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Privacidade</p>
            </a>
            <a
              href="/legal/terms-of-service.html"
              target="_blank"
              className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center active:scale-95 transition-all"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Termos</p>
            </a>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] text-white/40 font-bold uppercase text-center leading-relaxed">
            Bingola BETA - 2026<br />
            Voke Games - Todos os direitos reservados
          </div>

          <div className="pt-8 pb-4 flex flex-col items-center">
            <button
              onClick={handleDeleteAccount}
              className="group flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity"
            >
              <span className="text-xs font-bold text-red-500/80 group-hover:text-red-500">Excluir conta</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-red-500/40">Ação Irreversível</span>
            </button>
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

      {showPasswordModal && (
        <div className="fixed inset-0 z-[400] bg-background-dark/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="p-4 border-b border-white/5 flex items-center justify-between">
            <button onClick={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }} className="w-10 h-10 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
            <h3 className="font-black italic uppercase tracking-widest text-sm">Alterar Senha</h3>
            <div className="w-10"></div>
          </header>
          <main className="flex-1 p-6 space-y-8 flex flex-col justify-center max-w-md mx-auto w-full">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-blue-500 text-3xl">lock</span>
              </div>
              <h2 className="text-xl font-black uppercase italic italic tracking-tighter">Escolha sua nova senha</h2>
              <p className="text-xs text-white/40 font-medium">As alterações serão aplicadas instantaneamente.</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">Nova Senha</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">{showPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">Confirmar Senha</label>
                <div className="relative">
                  <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors" />
                  <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">{showConfirmPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-4">
              <button onClick={handleUpdatePassword} disabled={isChangingPassword} className="w-full bg-primary text-black font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
                {isChangingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-background-dark px-4 text-white/20">Ou</span></div>
              </div>
              <button onClick={handleChangePassword} disabled={isChangingPassword} className="w-full bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50">
                {isChangingPassword ? 'Enviando...' : 'Receber link por e-mail'}
              </button>
              <p className="text-[10px] text-white/20 text-center uppercase font-black tracking-widest">Use esta opção se esqueceu a senha atual</p>
            </div>
          </main>
        </div>
      )}

      {showExtrato && (
        <div className="fixed inset-0 z-[300] bg-background-dark/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="p-4 border-b border-white/5 flex items-center justify-between">
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
            ) : transactions.map((tx: any) => (
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
