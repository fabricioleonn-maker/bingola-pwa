
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [user, setUser] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchProfile = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser({
          ...profile,
          email: authUser.email
        });
        setNewName(profile.username || '');
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate('login');
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim() || !user) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newName })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, username: newName });
      setIsEditing(false);
      alert('Perfil atualizado!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) alert(error.message);
    else alert('E-mail de redefinição de senha enviado!');
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
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
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setUser({ ...user, avatar_url: publicUrl });
      alert('Foto de perfil atualizada com sucesso!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const addTestCoins = async () => {
    if (isUpdating || !user) return;
    setIsUpdating(true);

    const newBalance = (user.bcoins || 0) + 100;
    const { error } = await supabase
      .from('profiles')
      .update({ bcoins: newBalance })
      .eq('id', user.id);

    if (!error) {
      setUser({ ...user, bcoins: newBalance });
    }

    setTimeout(() => setIsUpdating(false), 1000);
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
              {user?.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt="User Profile" />
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
              LVL {user?.level || 1}
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
                @{user?.username || 'Explorador'}
                <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-colors text-xl">edit</span>
              </h1>
              <p className="text-white/40 text-sm mt-1">{user?.email || 'Visitante'}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
            <span className="material-symbols-outlined text-primary text-3xl mb-3">account_balance_wallet</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Saldo BCOINS</p>
            <p className="text-xl font-black mt-1 text-white">B$ {user?.bcoins || 0}</p>
          </div>
          <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
            <span className="material-symbols-outlined text-3xl mb-3 text-green-500">military_tech</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">BPOINTS</p>
            <p className="text-xl font-black mt-1 text-green-500">1.250</p>
          </div>
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

          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1 pt-4">Ações Rápidas</h3>

          <button
            onClick={addTestCoins}
            disabled={isUpdating}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">{isUpdating ? 'sync' : 'add_card'}</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Recarga de Teste</p>
                <p className="text-[10px] text-white/40">Adicionar +100 BCOINS instantaneamente</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-white/20">chevron_right</span>
          </button>
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
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined fill-1">person</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
        <button onClick={() => onNavigate('messages')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span className="text-[10px] font-bold">Avisos</span>
        </button>
      </nav>
    </div>
  );
};
