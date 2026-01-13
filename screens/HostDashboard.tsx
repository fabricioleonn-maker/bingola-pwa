
import React, { useState, useEffect } from 'react';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onPublish: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const HostDashboard: React.FC<Props> = ({ onBack, onPublish, onNavigate }) => {
  const [roomName, setRoomName] = useState('BINGOLA DE DOMINGO');
  const [playerLimit, setPlayerLimit] = useState<number>(10);
  const [rounds, setRounds] = useState<number>(1);
  const [bpoints, setBpoints] = useState<number>(500);
  const [isPublishing, setIsPublishing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    const userJson = localStorage.getItem('bingola_current_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserBalance(user.bcoins || 0);
    }
  }, []);

  const costPerSlot = Math.ceil(rounds / 5);
  const totalCost = costPerSlot * playerLimit;
  
  const canPublish = rounds >= 1 && playerLimit >= 1 && roomName.length > 3;

  const handlePublish = () => {
    if (!canPublish || isPublishing) return;

    if (playerLimit === 1) {
      if (!window.confirm("Atenção: Você está abrindo uma mesa para apenas 1 jogador (você mesmo). Deseja continuar?")) {
        return;
      }
    }

    if (userBalance < totalCost) {
      alert(`Saldo insuficiente! Esta mesa custa ${totalCost} BCOINS.`);
      onNavigate('store');
      return;
    }

    setIsPublishing(true);

    const userJson = localStorage.getItem('bingola_current_user');
    const usersJson = localStorage.getItem('bingola_users');
    
    if (userJson && usersJson) {
      const currentUser = JSON.parse(userJson);
      const allUsers = JSON.parse(usersJson);
      currentUser.bcoins -= totalCost;
      const updatedUsers = allUsers.map((u: any) => u.id === currentUser.id ? currentUser : u);
      localStorage.setItem('bingola_current_user', JSON.stringify(currentUser));
      localStorage.setItem('bingola_users', JSON.stringify(updatedUsers));
    }

    const shortCode = Math.floor(1000 + Math.random() * 9000).toString();
    const roomSettings = {
      name: roomName,
      limit: playerLimit,
      totalRounds: rounds,
      currentRound: 1,
      bpoints: bpoints,
      cost: totalCost,
      code: shortCode,
      isHost: true
    };
    
    localStorage.setItem('bingola_active_room', JSON.stringify(roomSettings));
    localStorage.setItem('bingola_game_running', 'false');
    localStorage.setItem('bingola_is_paused', 'false');
    localStorage.removeItem('bingola_drawn_numbers');
    localStorage.removeItem('bingola_player_marked');
    localStorage.removeItem('bingola_player_grid');
    localStorage.removeItem('bingola_claimed_prizes');
    localStorage.removeItem('bingola_last_winner');
    localStorage.removeItem(`bingola_join_requests_${shortCode}`);
    localStorage.setItem(`bingola_table_${shortCode}`, JSON.stringify([]));

    setTimeout(() => onPublish(), 800);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background-dark/80 backdrop-blur-md z-30">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold italic">Configurar Mesa</h2>
        <div className="bg-white/10 px-3 py-1 rounded-full border border-primary/30 flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-sm">payments</span>
          <span className="text-xs font-black">{userBalance}</span>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-8 pb-32 overflow-y-auto">
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Nome da Mesa</h3>
          <input 
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value.toUpperCase())}
            className="w-full h-16 bg-white/5 px-6 rounded-2xl text-base font-bold outline-none border border-white/10 focus:border-primary"
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Vagas e Rodadas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-white/40">VAGAS</label>
              <input type="number" min="1" value={playerLimit} onChange={(e) => setPlayerLimit(Math.max(1, parseInt(e.target.value) || 1))} className="w-full h-14 bg-white/5 rounded-xl text-center font-black border border-white/10 outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-white/40">RODADAS</label>
              <input type="number" min="1" value={rounds} onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))} className="w-full h-14 bg-white/5 rounded-xl text-center font-black border border-white/10 outline-none focus:border-primary" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-green-500">Premiação Interna (BPOINTS)</h3>
          <div className="relative">
             <input 
              type="number" 
              value={bpoints} 
              onChange={(e) => setBpoints(Math.max(0, parseInt(e.target.value) || 0))} 
              className="w-full h-16 bg-white/5 rounded-2xl text-center font-black text-2xl border border-white/10 outline-none focus:border-green-500" 
             />
             <span className="absolute right-6 top-1/2 -translate-y-1/2 text-green-500/50 text-[10px] font-bold uppercase tracking-widest">pts</span>
          </div>
        </section>

        <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 flex flex-col items-center gap-1 text-center">
          <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Custo de Abertura</p>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            <span className="text-4xl font-black text-primary">{totalCost} BCOINS</span>
          </div>
          <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest mt-4 italic leading-relaxed">
            Regra: 1 BCOIN por vaga a cada 5 rodadas.
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 border-t border-white/5 backdrop-blur-md">
        <button 
          onClick={handlePublish} 
          disabled={isPublishing} 
          className="w-full h-20 bg-primary text-white font-black text-xl rounded-3xl shadow-2xl transition-all active:scale-95"
        >
          {isPublishing ? 'PROCESSANDO...' : 'PAGAR E ABRIR MESA'}
        </button>
      </footer>
    </div>
  );
};
