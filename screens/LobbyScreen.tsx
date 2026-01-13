
import React, { useEffect, useState } from 'react';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onStart: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const LobbyScreen: React.FC<Props> = ({ onBack, onStart, onNavigate }) => {
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [pendingPlayers, setPendingPlayers] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const activeRoomJson = localStorage.getItem('bingola_active_room');
    if (activeRoomJson) {
      const r = JSON.parse(activeRoomJson);
      setRoom(r);
      
      const user = JSON.parse(localStorage.getItem('bingola_current_user') || '{}');
      setParticipants([{ id: user.id, name: user.name, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100', isHost: true }]);

      const checkRequests = () => {
        const reqs = JSON.parse(localStorage.getItem(`bingola_join_requests_${r.code}`) || '[]');
        setPendingPlayers(reqs);
      };

      const interval = setInterval(checkRequests, 2000);
      return () => clearInterval(interval);
    } else {
      onBack(); // Se não tem mesa ativa, volta pro início
    }
  }, []);

  const handleShare = async () => {
    if (!room) return;
    const shareText = `Vem pro Bingola!\nMesa: ${room.name}\nPIN: ${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bingola', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("PIN copiado para a área de transferência!");
      }
    } catch (err) {
      alert("PIN: " + room.code);
    }
  };

  const handleAuthorize = (player: any, allow: boolean) => {
    if (allow) {
      setParticipants(prev => [...prev, player]);
      const tablePlayers = JSON.parse(localStorage.getItem(`bingola_table_${room.code}`) || '[]');
      localStorage.setItem(`bingola_table_${room.code}`, JSON.stringify([...tablePlayers, player]));
    }
    const updated = pendingPlayers.filter(p => p.id !== player.id);
    setPendingPlayers(updated);
    localStorage.setItem(`bingola_join_requests_${room.code}`, JSON.stringify(updated));
    if (updated.length === 0) setShowAuthModal(false);
  };

  const handleStart = () => {
    localStorage.setItem('bingola_game_running', 'true');
    localStorage.setItem('bingola_is_paused', 'false');
    localStorage.setItem('bingola_last_draw_time', Date.now().toString());
    localStorage.removeItem('bingola_drawn_numbers');
    localStorage.removeItem('bingola_player_marked');
    localStorage.removeItem('bingola_last_winner');
    onStart();
  };

  if (!room) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white relative">
      <header className="sticky top-0 z-40 flex items-center bg-background-dark/90 backdrop-blur-md p-4 justify-between border-b border-white/5">
        <button onClick={onBack} className="text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center flex-1">
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40">Mesa do Anfitrião</h2>
          <p className="text-lg font-black text-primary truncate leading-tight">{room.name}</p>
        </div>
        <button onClick={() => onNavigate('room_settings')} className="flex size-12 items-center justify-end text-primary">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        <section className="flex flex-col items-center pt-8 px-6 mb-10">
          <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] w-full flex flex-col items-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16"></div>
             <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-2">PIN DE ACESSO</p>
             <h1 className="text-6xl font-black mb-6 tracking-tighter text-white">{room.code}</h1>
             <div className="w-48 h-48 bg-white rounded-3xl p-4 shadow-xl mb-6 cursor-pointer" onClick={handleShare}>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${room.code}`} className="w-full h-full rounded-xl" alt="QR" />
             </div>
             <button onClick={handleShare} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-6 py-3 rounded-full border border-primary/20 active:scale-95 transition-all">
               <span className="material-symbols-outlined text-sm">share</span> Convidar Amigos
             </button>
          </div>
        </section>

        {pendingPlayers.length > 0 && (
          <div className="mx-6 mb-8 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">person_add</span>
              <span className="text-xs font-black uppercase tracking-widest">{pendingPlayers.length} Aguardando</span>
            </div>
            <button onClick={() => setShowAuthModal(true)} className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-lg">AUTORIZAR</button>
          </div>
        )}

        <section className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black italic">Jogadores na Mesa</h3>
            <span className="bg-white/5 text-white/40 text-[10px] font-black px-3 py-1 rounded-full uppercase">
              {participants.length} / {room.limit} Vagas
            </span>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {participants.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="relative p-0.5 rounded-full border-2 border-primary">
                  <div className="size-14 rounded-full overflow-hidden">
                    <img src={p.avatar} className="w-full h-full object-cover" />
                  </div>
                  {p.isHost && (
                    <div className="absolute -top-1 -right-1 bg-yellow-500 text-black size-5 rounded-full flex items-center justify-center border-2 border-background-dark">
                      <span className="material-symbols-outlined text-[10px] font-black">crown</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-white/60 truncate w-full text-center">{p.name}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 border-t border-white/5 z-40">
        <button onClick={handleStart} className="w-full h-20 bg-primary text-white font-black text-xl rounded-[2rem] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95 transition-all italic">
          <span className="material-symbols-outlined text-2xl">play_circle</span>
          {room.currentRound > 1 ? `INICIAR RODADA ${room.currentRound}` : 'INICIAR PARTIDA'}
        </button>
      </footer>

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
              <h3 className="text-2xl font-black text-center mb-6 italic">Autorizar Entrada</h3>
              <div className="space-y-4 mb-8 max-h-[40vh] overflow-y-auto pr-2">
                 {pendingPlayers.map(p => (
                   <div key={p.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                         <img src={p.avatar} className="size-10 rounded-full" />
                         <span className="font-bold text-sm">{p.name}</span>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => handleAuthorize(p, false)} className="size-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                         <button onClick={() => handleAuthorize(p, true)} className="size-10 bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">check</span></button>
                      </div>
                   </div>
                 ))}
              </div>
              <button onClick={() => setShowAuthModal(false)} className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl">FECHAR</button>
           </div>
        </div>
      )}
    </div>
  );
};
