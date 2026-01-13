
import React, { useEffect, useState } from 'react';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [user, setUser] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadUser = () => {
    const userJson = localStorage.getItem('bingola_current_user');
    if (userJson) {
      setUser(JSON.parse(userJson));
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('bingola_current_user');
    onNavigate('login');
  };

  const addTestCoins = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    const userJson = localStorage.getItem('bingola_current_user');
    let currentUser = user;

    if (!userJson) {
      currentUser = {
        id: 'test_' + Date.now(),
        name: 'Tester',
        email: 'test@bingola.com',
        bcoins: 100,
        level: 1
      };
      localStorage.setItem('bingola_users', JSON.stringify([currentUser]));
    } else {
      currentUser = JSON.parse(userJson);
      currentUser.bcoins = (currentUser.bcoins || 0) + 100;
      
      const usersJson = localStorage.getItem('bingola_users');
      if (usersJson) {
        const users = JSON.parse(usersJson);
        const updatedUsers = users.map((u: any) => u.id === currentUser.id ? currentUser : u);
        localStorage.setItem('bingola_users', JSON.stringify(updatedUsers));
      }
    }

    localStorage.setItem('bingola_current_user', JSON.stringify(currentUser));
    setUser({ ...currentUser });
    
    setTimeout(() => setIsUpdating(false), 1000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white">settings</span>
        </button>
        <h2 className="text-lg font-bold">Meu Perfil</h2>
        <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center text-red-500">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="flex flex-col items-center py-10">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full border-4 border-primary p-1 shadow-2xl shadow-primary/10 overflow-hidden">
              <img src="https://picsum.photos/200/200" className="w-full h-full rounded-full object-cover" alt="User Profile" />
            </div>
            <div className="absolute bottom-1 right-1 bg-primary text-black font-black text-[10px] px-3 py-1 rounded-full border-2 border-background-dark">
              LVL {user?.level || 1}
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">@{user?.name || 'Explorador'}</h1>
          <p className="text-white/40 text-sm mt-1">{user?.email || 'Visitante'}</p>
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
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Personalização</h3>
          
          <button 
            onClick={() => onNavigate('customization')}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-500">style</span>
               </div>
               <div className="text-left">
                  <p className="font-bold text-sm">Estilo da Cartela</p>
                  <p className="text-[10px] text-white/40">Pré-definir cores, fontes e carimbos</p>
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
