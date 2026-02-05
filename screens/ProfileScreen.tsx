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
    <div className="flex-1 flex flex-col min-h-0">
      <header className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-white/60">arrow_back</span>
        </button>
        <h2 className="text-lg font-black italic uppercase tracking-widest text-white/90">Meu Perfil</h2>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-6 pb-32 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center mb-8 mt-4">
          <div
            onClick={handlePhotoClick}
            className="w-28 h-28 rounded-full border-4 border-primary p-1 mb-4 relative group cursor-pointer"
          >
            {uploading ? (
              <div className="w-full h-full rounded-full bg-black/40 flex items-center justify-center animate-pulse">
                <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full rounded-full bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white/20">person</span>
              </div>
            )}
            <button onClick={handlePhotoClick} className="absolute bottom-1 right-1 bg-primary text-black rounded-full p-2 hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-sm font-black">photo_camera</span>
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePWAFileUpload}
            className="hidden"
            accept="image/*"
          />

          {isEditing ? (
            <div className="w-full max-w-[280px] space-y-4 flex flex-col items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Seu Nome Completo"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center font-black uppercase text-xl placeholder:text-white/20 focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2 w-full">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-xs font-black uppercase tracking-widest text-white/40">Cancelar</button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  className="flex-[2] py-3 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  {isUpdating ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-3xl font-black uppercase italic tracking-tighter">
                {profile?.full_name || profile?.username || 'CARREGANDO...'}
              </h1>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-base">edit</span>
                Editar Perfil
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 text-center">
            <span className="material-symbols-outlined text-primary mb-2">stars</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Nível</p>
            <p className="text-2xl font-black italic">{profile?.level || 1}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 text-center">
            <span className="material-symbols-outlined text-primary mb-2">payments</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">B-Coins</p>
            <p className="text-2xl font-black italic">{profile?.bcoins || 0}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4 uppercase">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-white/20 pl-4">Indicação</h3>
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 rounded-[2.5rem] p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black italic text-primary">CÓDIGO DE CONVITE</p>
                  <p className="text-3xl font-black tracking-widest mt-1 uppercase">{profile?.referral_code || '---'}</p>
                </div>
                <button
                  onClick={shareReferral}
                  className="size-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-2xl font-black">share</span>
                </button>
              </div>
              <p className="text-[10px] font-bold text-white/40 uppercase leading-relaxed pr-8">
                INDIQUE AMIGOS E GANHE <span className="text-white">500 B-COINS</span> POR CADA CADASTRO REALIZADO.
              </p>
            </div>
          </div>

          <div className="space-y-4 uppercase">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-white/20 pl-4">Segurança</h3>
            <button onClick={() => setShowPasswordModal(true)} className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-white/40">lock</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black">ALTERAR SENHA</p>
                  <p className="text-[10px] font-bold text-white/20">PROTEJA SUA CONTA</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-white/20 group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>

          <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 border border-red-500/20 rounded-3xl p-5 text-red-500 font-black uppercase tracking-widest text-xs active:scale-95 transition-all">
            Sair do Jogo
          </button>
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
    </div>
  );
};
