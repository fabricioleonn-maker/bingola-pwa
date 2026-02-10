import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useUserStore } from '../state/userStore';
import { AppScreen } from '../types';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';

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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showExtrato, setShowExtrato] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Master Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [giftAmount, setGiftAmount] = useState('');

  // Ref for hidden file input (PWA Fallback)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfileData = async () => {
    await refreshProfile();
    const { data: { user: authUser } } = await supabase.auth.getUser();

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

  const handleUpdateProfile = async () => {
    if (!newName.trim() || !profile) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
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

  const handlePhotoClick = async () => {
    setUploading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Base64,
          source: CameraSource.Prompt,
        });

        if (image.base64String && profile?.id) {
          const filePath = `${profile.id}/avatar_${Date.now()}.png`;
          const base64Data = image.base64String;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', profile.id);

          if (updateError) throw updateError;
          await refreshProfile();
          useNotificationStore.getState().show('Foto atualizada!', 'success');
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.message !== 'User cancelled photos app') {
        useNotificationStore.getState().show(err.message || 'Erro ao carregar foto', 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePWAFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const filePath = `${profile.id}/avatar_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      await refreshProfile();
      useNotificationStore.getState().show('Foto atualizada!', 'success');
    } catch (err: any) {
      useNotificationStore.getState().show(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const shareReferral = async () => {
    const shareText = `Use meu código ${profile?.referral_code} no Bingola e ganhe bônus! Baixe em https://bingola.app`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Bingola',
          text: shareText,
          url: 'https://bingola.app',
          dialogTitle: 'Compartilhar Código',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Bingola',
          text: shareText,
          url: 'https://bingola.app',
        });
      } else {
        copyToClipboard(profile?.referral_code || '', "Código");
      }
    } catch (error) {
      console.log('Error sharing', error);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      <header className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-white/60">arrow_back</span>
        </button>
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Meu Perfil</h2>
        <button onClick={() => supabase.auth.signOut()} className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-full active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-red-500">logout</span>
        </button>
      </header>

      <main className="flex-1 px-6 pb-40 overflow-y-auto no-scrollbar">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8 mt-6">
          <div className="relative w-32 h-32 rounded-full bg-white/5 border-2 border-white/10 mb-4 flex items-center justify-center overflow-hidden active:scale-95 transition-transform">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white/20 text-6xl">person</span>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePWAFileUpload}
              className="hidden"
              accept="image/*"
            />
            <button onClick={handlePhotoClick} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? (
                <span className="material-symbols-outlined text-white animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-white">
                @{profile?.username || 'USUÁRIO'}
              </h1>
              <button onClick={() => setIsEditing(true)} className="text-white/20">
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            </div>
            <p className="text-sm font-medium text-white/20">{profile?.email || 'email@exemplo.com'}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#0D0D12] border border-white/5 rounded-[2rem] p-6 space-y-3 relative overflow-hidden group active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">wallet</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Saldo Bcoins</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-black text-white">B$ {profile?.bcoins || 0}</p>
                <button onClick={() => setShowExtrato(true)} className="text-[10px] font-black uppercase text-primary">Extrato</button>
              </div>
            </div>
          </div>

          <div className="bg-[#0D0D12] border border-white/5 rounded-[2rem] p-6 space-y-3 relative overflow-hidden group active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-500 text-xl">military_tech</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">BPoints (Ranking)</p>
              <p className="text-2xl font-black text-green-500 mt-1">{profile?.bpoints || 0}</p>
            </div>
          </div>
        </div>

        {/* Referral Card */}
        <div className="bg-gradient-to-br from-[#0D0D12] to-primary/10 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-xl mb-12">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Seu código de indicação</p>
            <div className="flex items-center justify-between">
              <p className="text-4xl font-black tracking-widest text-white uppercase italic">{profile?.referral_code || '---'}</p>
              <div className="flex gap-3">
                <button onClick={() => copyToClipboard(profile?.referral_code || '', "Código")} className="size-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 active:scale-90 transition-transform">
                  <span className="material-symbols-outlined">content_copy</span>
                </button>
                <button onClick={shareReferral} className="size-12 bg-primary text-black rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                  <span className="material-symbols-outlined">share</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] font-bold text-white/40 leading-relaxed">
            Convide amigos e ganhe 10 BCOINS quando eles usarem seu código na primeira compra! Eles ganham 10% de desconto!
          </p>
        </div>

        {/* Menu Sections */}
        <div className="space-y-10 mb-20">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black tracking-[0.2em] text-white/20 pl-2 uppercase">Segurança e Dados</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full bg-[#0D0D12] border border-white/5 rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500">lock_reset</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase text-white">Alterar Senha</p>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Definir nova senha agora</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/10 group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>

              <button
                onClick={() => onNavigate('customization')}
                className="w-full bg-[#0D0D12] border border-white/5 rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-500">style</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase text-white">Customização</p>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Estilos de cartela e animações</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/10 group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[11px] font-black tracking-[0.2em] text-white/20 pl-2 uppercase">Termos e Legal</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-[#0D0D12] border border-white/5 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-white/40 active:scale-95 transition-all">Privacidade</button>
              <button className="bg-[#0D0D12] border border-white/5 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-white/40 active:scale-95 transition-all">Termos</button>
            </div>
          </div>

          <div className="bg-[#0D0D12] border border-white/5 py-6 rounded-[2rem] flex flex-col items-center gap-1 opacity-50">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Bingola Beta - 2026</p>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Voke Games - Todos os direitos reservados</p>
          </div>

          <div className="flex flex-col items-center gap-1 pt-4 pb-10">
            <button
              onClick={() => {
                useNotificationStore.getState().confirm({
                  title: "Excluir Conta?",
                  message: "Esta ação é IRREVERSÍVEL. Todos os seus dados, BCoins e BPoints serão permanentemente apagados.",
                  onConfirm: async () => {
                    setIsUpdating(true);
                    try {
                      // Chama a função RPC segura para deletar o usuário
                      const { error } = await supabase.rpc('delete_current_user_data');
                      if (error) throw error;

                      useNotificationStore.getState().show("Sua conta foi excluída com sucesso.", 'success');

                      // Logout e redirecionamento
                      await supabase.auth.signOut();
                      window.location.reload();
                    } catch (err: any) {
                      console.error("Erro ao excluir conta:", err);
                      useNotificationStore.getState().show(err.message || "Erro ao excluir conta", 'error');
                    } finally {
                      setIsUpdating(false);
                    }
                  }
                });
              }}
              disabled={isUpdating}
              className="text-red-500/40 font-black text-sm uppercase tracking-widest active:opacity-60 transition-opacity disabled:opacity-20"
            >
              {isUpdating ? 'Excluindo...' : 'Excluir conta'}
            </button>
            <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.2em]">Ação irreversível.</p>
          </div>
        </div>
      </main>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[300] bg-background-dark/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
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
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Escolha sua nova senha</h2>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-4 pb-[max(24px,calc(1.5rem+env(safe-area-inset-bottom)))] px-2 z-50">
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
        {useUserStore.getState().isMaster && (
          <button onClick={() => onNavigate('master_hub')} className="flex flex-col items-center gap-1 text-yellow-500 animate-pulse">
            <span className="material-symbols-outlined">construction</span>
            <span className="text-[10px] font-bold">Admin</span>
          </button>
        )}
        <button onClick={() => onNavigate('store')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined storefront">storefront</span>
          <span className="text-[10px] font-bold">Loja</span>
        </button>
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined fill-1">person</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>
    </div>
  );
};
