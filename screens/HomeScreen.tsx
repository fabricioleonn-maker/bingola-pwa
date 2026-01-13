
import React, { useEffect, useState } from 'react';
import { AppScreen } from '../types';

interface HomeProps {
  onNavigate: (screen: AppScreen) => void;
}

export const HomeScreen: React.FC<HomeProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('Explorador');
  const [balance, setBalance] = useState(0);
  const [hasActiveRoom, setHasActiveRoom] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [lastDrawn, setLastDrawn] = useState<number | null>(null);

  const getBingoLabel = (num: number): string => {
    if (num <= 0) return "";
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  useEffect(() => {
    const userJson = localStorage.getItem('bingola_current_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        setUserName(user.name || user.email.split('@')[0]);
        setBalance(user.bcoins || 0);
      } catch (e) { console.error(e); }
    }

    const checkState = () => {
      const activeRoom = localStorage.getItem('bingola_active_room');
      const running = localStorage.getItem('bingola_game_running') === 'true';
      const drawn = JSON.parse(localStorage.getItem('bingola_drawn_numbers') || '[]');
      
      setHasActiveRoom(!!activeRoom);
      setIsGameRunning(running);
      if (drawn.length > 0) {
        setLastDrawn(drawn[drawn.length - 1]);
      } else {
        setLastDrawn(null);
      }
    };

    checkState();
    const interval = setInterval(checkState, 500); // Sincronização rápida
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background-dark pb-24">
      <header className="flex items-center justify-between p-6 pt-10">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">Olá, {userName}! 👋</h2>
          <div className="bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30 w-fit mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary text-[14px]">payments</span>
            <span className="text-[12px] font-black text-white">{balance} BCOINS</span>
          </div>
        </div>
        <div className="cursor-pointer" onClick={() => onNavigate('profile')}>
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 p-0.5">
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" className="w-full h-full rounded-full object-cover" alt="Profile" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-6">
        {isGameRunning && (
          <div 
            onClick={() => onNavigate('game')}
            className="bg-gradient-to-r from-primary to-secondary p-4 rounded-3xl shadow-xl animate-in slide-in-from-top-4 duration-500 cursor-pointer group active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center shadow-lg overflow-hidden">
                  <span className="text-primary font-black text-[10px] mb-[-4px] opacity-60">{lastDrawn ? getBingoLabel(lastDrawn) : ""}</span>
                  <span className="text-primary font-black text-xl">{lastDrawn || '--'}</span>
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">Sorteio Rolando</h4>
                  <p className="text-white/60 text-[10px]">Toque para ver a cartela</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-white animate-pulse">fullscreen</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => onNavigate(isGameRunning ? 'game' : (hasActiveRoom ? 'lobby' : 'host_dashboard'))}
            className={`flex flex-col items-center justify-center h-48 rounded-3xl shadow-xl relative overflow-hidden group active:scale-95 transition-all ${isGameRunning || hasActiveRoom ? 'bg-secondary' : 'bg-primary'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-white text-3xl">{isGameRunning ? 'play_circle' : (hasActiveRoom ? 'meeting_room' : 'add')}</span>
            </div>
            <span className="text-white font-bold text-lg">{isGameRunning ? 'Ver Jogo' : (hasActiveRoom ? 'Lobby da Mesa' : 'Criar Nova Sala')}</span>
            <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mt-1">
              {isGameRunning ? 'Partida ativa' : (hasActiveRoom ? 'Sua mesa aberta' : 'Sorteio em grupo')}
            </span>
          </button>

          <button onClick={() => onNavigate('participant_lobby')} className="flex flex-col items-center justify-center h-48 bg-surface-dark border border-white/10 rounded-3xl group active:scale-95 transition-transform">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">keyboard</span>
            </div>
            <span className="text-white font-bold text-lg">Entrar com Código</span>
          </button>
        </div>

        <section>
          <h3 className="text-lg font-bold mb-4">Mesas Próximas</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {[
              { name: 'Bingo da Vovó', img: 'https://images.unsplash.com/photo-1518133839073-42716b066fe8?q=80&w=200&auto=format&fit=crop' },
              { name: 'Mesa Premium', img: 'https://images.unsplash.com/photo-1595113316349-9fa4ee24f884?q=80&w=200&auto=format&fit=crop' },
              { name: 'Happy Hour', img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200&auto=format&fit=crop' }
            ].map((item, i) => (
              <div key={i} className="flex-none w-36 space-y-2 group cursor-pointer">
                <div className="aspect-square rounded-2xl bg-surface-dark border border-white/5 relative overflow-hidden">
                  <img src={item.img} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform" />
                </div>
                <p className="font-bold text-sm truncate">{item.name}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-3 px-6 z-50">
        <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined fill-1">home</span>
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button onClick={() => onNavigate('ranking')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">leaderboard</span>
          <span className="text-[10px] font-bold">Ranking</span>
        </button>
        <button onClick={() => onNavigate('store')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-[10px] font-bold">Loja</span>
        </button>
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>
    </div>
  );
};
