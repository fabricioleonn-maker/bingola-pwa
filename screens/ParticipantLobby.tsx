
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';
import { useRoomStore } from '../state/roomStore';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const ParticipantLobby: React.FC<Props> = ({ onBack, onNavigate }) => {
  const roomId = useRoomStore(s => s.roomId);
  const room = useRoomStore(s => s.room);
  const acceptedList = useRoomStore(s => s.accepted);
  const myStatus = useRoomStore(s => s.myStatus);
  const refreshParticipants = useRoomStore(s => s.refreshParticipants);

  const [hostProfile, setHostProfile] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigatedToGameRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    refreshParticipants(roomId);

    const hydrateHost = async () => {
      if (room?.host_id) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', room.host_id).single();
        if (profile) setHostProfile({
          id: profile.id,
          name: profile.username,
          avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
          isHost: true,
          level: profile.level,
          bcoins: profile.bcoins
        });
      }
    };

    hydrateHost();
  }, [roomId, room?.host_id, refreshParticipants]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  // Immediate navigation via Realtime Broadcast
  useEffect(() => {
    if (!roomId) return;

    const channel = useRoomStore.getState().channel;
    if (!channel) return;

    const sub = channel.on('broadcast', { event: 'game_started' }, (payload) => {
      // FIX: Only auto-navigate if ACCEPTED
      if (payload.roomId === roomId && !navigatedToGameRef.current && myStatus === 'accepted') {
        navigatedToGameRef.current = true;
        onNavigate('game');
      }
    });

    return () => {
      try {
        if (channel && typeof (channel as any).off === 'function') {
          (channel as any).off('broadcast', { event: 'game_started' });
        }
      } catch (err) { console.warn("Failed to detach listener", err); }
    };
  }, [roomId, onNavigate, myStatus]);

  // Fallback navigation via DB poll
  useEffect(() => {
    // FIX: Only auto-navigate if ACCEPTED
    if (myStatus !== 'accepted') return;

    if (room?.status === 'playing' && !navigatedToGameRef.current) {
      navigatedToGameRef.current = true;
      onNavigate('game');
    }
  }, [room?.status, onNavigate, myStatus]);

  if (myStatus === 'rejected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black relative overflow-hidden animate-in fade-in duration-700">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] animate-pulse"></div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8 p-8 max-w-sm w-full">
          <div className="relative">
            <div className="size-32 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(220,38,38,0.5)] border-4 border-red-400 animate-bounce">
              <span className="material-symbols-outlined text-white text-6xl">block</span>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-red-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
              Bloqueado
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-md">
              Acesso <span className="text-red-500">Negado</span>
            </h2>
            <p className="text-white/60 text-sm leading-relaxed font-medium">
              O anfitrião recusou sua entrada ou removeu você permanentemente desta mesa.
            </p>
          </div>

          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-black mb-1">Mesa</p>
            <p className="text-white font-bold text-lg">{room?.name || 'Mesa Desconhecida'}</p>
          </div>

          <button
            onClick={() => {
              useRoomStore.getState().setRoomId(null);
              onNavigate('home');
            }}
            className="w-full h-14 bg-white text-black rounded-xl font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (!room || !myStatus) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background-dark text-white/50 space-y-4">
      <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black italic animate-pulse">Sincronizando Mesa...</p>
      <button onClick={onBack} className="text-xs underline mt-8">Voltar para Home</button>
    </div>
  );

  if (myStatus === 'pending') return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background-dark text-white p-8 text-center space-y-8">
      <div className="size-32 bg-primary/10 rounded-[3rem] flex items-center justify-center animate-pulse">
        <span className="material-symbols-outlined text-primary text-6xl">pending_actions</span>
      </div>
      <div className="space-y-4">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Aguardando Aprovação</h2>
        <p className="text-white/50 text-sm leading-relaxed">Sua solicitação foi enviada. O anfitrião precisa autorizar sua entrada na mesa.</p>
      </div>
      <div className="w-full max-w-xs bg-white/5 p-6 rounded-3xl border border-white/10">
        <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">Mesa Selecionada</p>
        <p className="font-black text-primary text-xl uppercase">{room.name}</p>
        <p className="text-white/40 font-bold mt-1 tracking-widest text-[10px]">CÓD MESA: {room.code}</p>
      </div>
      <button onClick={onBack} className="bg-white/5 hover:bg-white/10 text-white/40 px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all">Cancelar Solicitação</button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white relative">
      <header className="sticky top-0 z-40 flex items-center bg-background-dark/90 backdrop-blur-md p-4 justify-between border-b border-white/5">
        <button onClick={onBack} className="text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center flex-1">
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">CÓD MESA: {room.code}</h2>
          <p className="text-lg font-black text-primary truncate leading-tight uppercase italic">{room.name}</p>
        </div>
        <button onClick={() => onNavigate('customization')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-2xl">palette</span>
          <span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Cor da Sorte</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        <section className="flex flex-col items-center pt-8 px-6 mb-8">
          <div className="bg-white/10 border border-white/10 p-8 rounded-[2.5rem] w-full flex flex-col items-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 animate-pulse"></div>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Prêmios da Mesa</p>

            <div className="grid grid-cols-2 gap-3 w-full">
              {(() => {
                const patterns = (room as any).winning_patterns;
                const list = [];
                if (!patterns || (typeof patterns === 'object' && Object.values(patterns).every(v => v === false))) {
                  list.push({ label: 'Cartela Cheia', icon: 'auto_awesome' });
                } else if (Array.isArray(patterns)) {
                  patterns.forEach(p => list.push({ label: p, icon: 'verified' }));
                } else if (typeof patterns === 'object') {
                  if (patterns.cheia) list.push({ label: 'Cartela Cheia', icon: 'auto_awesome' });
                  if (patterns.cinquina) list.push({ label: 'Cinquina', icon: 'filter_5' });
                  if (patterns.cantos) list.push({ label: 'Cantos', icon: 'grid_view' });
                  if (patterns.x) list.push({ label: 'Cartela em X', icon: 'close' });
                }

                const potRaw = (room as any)?.prize_pool || (room as any)?.prizePool || (room as any)?.prize_pot || (room as any)?.bpoints || 0;
                const pot = Number(potRaw);

                return list.map((p, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col items-center text-center">
                    <span className="material-symbols-outlined text-primary mb-1 text-2xl">{p.icon}</span>
                    <span className="text-[9px] font-black uppercase text-white tracking-widest leading-none mb-1">{p.label}</span>
                    <p className="text-green-500 font-black text-[11px] leading-none">
                      B$ {p.label === 'Cartela Cheia' ? Math.floor(pot * 0.7) : Math.floor(pot * 0.3)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </section>

        <section className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black italic">Jogadores na Mesa</h3>
            <span className="bg-white/5 text-white/40 text-[10px] font-black px-3 py-1 rounded-full uppercase">
              {acceptedList.length + (room.host_id ? 1 : 0)} / {room.player_limit || 20}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {hostProfile && (
              <div className="flex flex-col items-center gap-2" onClick={() => setSelectedPlayer(hostProfile)}>
                <div className="relative p-0.5 rounded-full border-2 border-primary">
                  <div className="size-14 rounded-full overflow-hidden">
                    <img src={hostProfile.avatar} className="w-full h-full object-cover" alt="Host" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-black size-5 rounded-full flex items-center justify-center border-2 border-background-dark">
                    <span className="material-symbols-outlined text-[10px] font-black">crown</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white/60 truncate w-full text-center">{hostProfile.name}</span>
              </div>
            )}
            {acceptedList.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-2" onClick={() => setSelectedPlayer({
                name: p.profiles?.username || 'Jogador',
                avatar: p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
                level: p.profiles?.level,
                bcoins: p.profiles?.bcoins
              })}>
                <div className="relative p-0.5 rounded-full border-2 border-white/10">
                  <div className="size-14 rounded-full overflow-hidden">
                    <img src={p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="w-full h-full object-cover" alt="Player" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white/60 truncate w-full text-center">{p.profiles?.username || 'Jogador'}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 px-8 text-center space-y-4">
          <div className="animate-bounce">
            <span className="material-symbols-outlined text-5xl text-primary opacity-50">hourglass_empty</span>
          </div>
          <p className="text-xl font-black italic">Aguardando Anfitrião...</p>
          <p className="text-xs text-white/40 leading-relaxed px-4">O jogo começará instantaneamente assim que todos estiverem prontos!</p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background-dark/80 backdrop-blur-md border-t border-white/5 z-30 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">CÓDIGO DA MESA:</span>
          <span className="text-primary font-black text-lg tracking-widest">{room.code}</span>
        </div>
      </footer>

      {selectedPlayer && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="size-24 rounded-full border-4 border-primary/20 mx-auto mb-6 p-1">
              <img src={selectedPlayer.avatar} className="size-full rounded-full object-cover" alt="User Profile" />
            </div>
            <h3 className="text-2xl font-black italic mb-1">{selectedPlayer.name}</h3>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-8">Nível {selectedPlayer.level || 1} • {selectedPlayer.bcoins || 0} BCOINS</p>
            <button onClick={() => setSelectedPlayer(null)} className="w-full h-16 bg-primary text-white font-black rounded-2xl">FECHAR</button>
          </div>
        </div>
      )}
    </div>
  );
};
