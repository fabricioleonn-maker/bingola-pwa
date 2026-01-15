
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';
import { useRoomStore } from '../state/roomStore';
import { useNotificationStore } from '../state/notificationStore';

interface Props {
  onBack: () => void;
  onStart: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const LobbyScreen: React.FC<Props> = ({ onBack, onStart, onNavigate }) => {
  const roomId = useRoomStore(s => s.roomId);
  const room = useRoomStore(s => s.room);
  const pending = useRoomStore(s => s.pending);
  const accepted = useRoomStore(s => s.accepted);
  const approve = useRoomStore(s => s.approve);
  const reject = useRoomStore(s => s.reject);
  const refreshParticipants = useRoomStore(s => s.refreshParticipants);
  const subscribe = useRoomStore(s => s.subscribe);

  const [hostProfile, setHostProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Garante dados frescos ao entrar
    refreshParticipants(roomId);

    // Subscribe to Realtime events (CRITICAL FIX)
    const unsubscribe = subscribe(roomId);

    const hydrateHost = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
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

    return () => {
      unsubscribe();
    };
  }, [roomId, refreshParticipants, subscribe]);

  useEffect(() => {
    if (pending.length > 0) setShowAuthModal(true);
  }, [pending.length]);

  // Auto-close modal when empty
  useEffect(() => {
    if (pending.length === 0 && showAuthModal) {
      setShowAuthModal(false);
    }
  }, [pending.length, showAuthModal]);

  // Redireciona se a sala já estiver jogando (ex.: refresh ou trigger remoto)
  useEffect(() => {
    if (room?.status === 'playing' && currentUserId) {
      const isHost = room.host_id === currentUserId;
      // Strict check: must be in the accepted list with status 'accepted'
      const isAccepted = accepted.some(p => p.user_id === currentUserId && p.status === 'accepted');

      if (isHost || isAccepted) {
        onStart();
      }
      // If not strictly accepted, do NOTHING. Stay here waiting for approval.
    }
  }, [room?.status, onStart, currentUserId, accepted, room?.host_id]);

  const handleShare = async () => {
    if (!room) return;
    const shareText = `Vem pro Bingola!\nMesa: ${room.name}\nPIN: ${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bingola', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        useNotificationStore.getState().show("PIN copiado!", 'info');
      }
    } catch (err) {
      useNotificationStore.getState().show("PIN: " + room.code, 'info');
    }
  };

  const handleAuthorize = async (participantId: string, allow: boolean) => {
    if (allow) {
      // FIX: Check Player Limit before approving (Host + Accepted)
      const limit = room?.player_limit || 20;
      if ((accepted.length + 1) >= limit) {
        useNotificationStore.getState().show("Limite de jogadores atingido nesta mesa!", 'error');
        return;
      }

      await approve(participantId);
      useNotificationStore.getState().show("Jogador aceito!", 'success');
    } else {
      await reject(participantId);
    }
  };

  const handleStart = async () => {
    if (!room) return;

    // 1. Optimistic Updates (Instant Feedback)
    useRoomStore.getState().updateRoomStatus('playing');
    localStorage.setItem('bingola_game_running', 'true');
    localStorage.setItem('bingola_is_paused', 'false');
    // Force immediate draw
    localStorage.setItem('bingola_last_draw_time', (Date.now() - 60000).toString());
    localStorage.removeItem('bingola_player_marked');
    localStorage.removeItem('bingola_last_winner');

    // 2. Navigate immediately
    onStart();

    // 3. Background Operations
    try {
      // Broadcast
      const channel = useRoomStore.getState().channel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'game_started',
          payload: { roomId: room.id }
        });
      }

      // Database Update
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', room.id);

      if (error) throw error;

    } catch (err) {
      console.error("Background Start Error:", err);
      // If it fails, we might want to revert, but usually it succeeds.
      // For now, just toast.
      useNotificationStore.getState().show("Sincronizando início...", 'info');
    }
  };

  const handleBack = async () => {
    // Just minimize (navigate home) without cancelling
    onBack();
  };

  if (!room) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white relative">
      <header className="sticky top-0 z-40 flex items-center bg-background-dark/90 backdrop-blur-md p-4 justify-between border-b border-white/5">
        <button onClick={handleBack} className="text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center flex-1">
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">CÓD MESA: {room.code}</h2>
          <p className="text-lg font-black text-primary truncate leading-tight uppercase italic">{room.name}</p>
        </div>
        <button onClick={() => onNavigate('room_settings')} className="flex size-12 items-center justify-end text-primary">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        <section className="flex flex-col items-center pt-8 px-6 mb-10">
          <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] w-full flex flex-col items-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16"></div>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-2">CÓD MESA DE ACESSO</p>
            <h1 className="text-6xl font-black mb-6 tracking-tighter text-white">{room.code}</h1>
            <div className="w-48 h-48 bg-white rounded-3xl p-4 shadow-xl mb-6 cursor-pointer" onClick={handleShare}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${room.code}`} className="w-full h-full rounded-xl" alt="QR" />
            </div>
            <button onClick={handleShare} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-6 py-3 rounded-full border border-primary/20 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm">share</span> Convidar Amigos
            </button>
          </div>
        </section>

        {pending.length > 0 && (
          <div className="mx-6 mb-8 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">person_add</span>
              <span className="text-xs font-black uppercase tracking-widest">{pending.length} Aguardando</span>
            </div>
            <button onClick={() => setShowAuthModal(true)} className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-lg">AUTORIZAR</button>
          </div>
        )}

        <section className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black italic">Jogadores na Mesa</h3>
            <span className="bg-white/5 text-white/40 text-[10px] font-black px-3 py-1 rounded-full uppercase">
              {accepted.length + (hostProfile ? 1 : 0)} / {room.player_limit || 20} Vagas
            </span>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {hostProfile && (
              <div className="flex flex-col items-center gap-2" onClick={() => setSelectedPlayer(hostProfile)}>
                <div className="relative p-0.5 rounded-full border-2 border-primary">
                  <div className="size-14 rounded-full overflow-hidden">
                    <img src={hostProfile.avatar} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-black size-5 rounded-full flex items-center justify-center border-2 border-background-dark">
                    <span className="material-symbols-outlined text-[10px] font-black">crown</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white/60 truncate w-full text-center">{hostProfile.name}</span>
              </div>
            )}
            {accepted.map((p, i) => {
              const profile = p.profiles;
              return (
                <div key={i} className="flex flex-col items-center gap-2" onClick={() => setSelectedPlayer({
                  name: profile?.username || 'Jogador',
                  avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
                  level: profile?.level,
                  bcoins: profile?.bcoins,
                  id: p.id, // Participant ID for kicking
                  userId: p.user_id // User ID for identifying self
                })}>
                  <div className="relative p-0.5 rounded-full border-2 border-white/10">
                    <div className="size-14 rounded-full overflow-hidden">
                      <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-white/60 truncate w-full text-center">{profile?.username || 'Jogador'}</span>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 border-t border-white/5 z-40">
        <button onClick={handleStart} className="w-full h-20 bg-primary text-white font-black text-xl rounded-[2rem] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95 transition-all italic">
          <span className="material-symbols-outlined text-2xl">play_circle</span>
          {room.current_round && room.current_round > 1 ? `INICIAR RODADA ${room.current_round}` : 'INICIAR PARTIDA'}
        </button>
      </footer>

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black text-center mb-6 italic">Autorizar Entrada</h3>
            <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {pending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest pl-1">Aguardando Aprovação</p>
                  {pending.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <img src={p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full border border-primary/20" />
                        <span className="font-bold text-sm">{p.profiles?.username || 'Jogador'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAuthorize(p.id, false)} className="size-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                        <button onClick={() => handleAuthorize(p.id, true)} className="size-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">check</span></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1 mt-4">Participantes na Mesa</p>
                {accepted.length === 0 ? (
                  <p className="text-center text-white/30 text-[10px] py-4 italic">Aguardando jogadores entrarem...</p>
                ) : accepted.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl opacity-60">
                    <div className="flex items-center gap-3">
                      <img src={p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full grayscale" />
                      <span className="font-bold text-sm text-white/70">{p.profiles?.username || 'Jogador'}</span>
                    </div>
                    <span className="material-symbols-outlined text-green-500/40 text-sm">check_circle</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowAuthModal(false)} className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl">FECHAR</button>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm text-center shadow-[0_0_50px_rgba(255,61,113,0.1)]" onClick={e => e.stopPropagation()}>
            <div className="size-24 rounded-full border-4 border-primary/20 mx-auto mb-6 p-1">
              <img src={selectedPlayer.avatar} className="size-full rounded-full object-cover" />
            </div>
            <h3 className="text-2xl font-black italic mb-1">{selectedPlayer.name}</h3>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-8">Nível {selectedPlayer.level || 1} • {selectedPlayer.bcoins || 0} BCOINS</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="material-symbols-outlined text-primary mb-1">casino</span>
                <p className="text-[8px] font-black text-white/40 uppercase">Jogos</p>
                <p className="font-bold">124</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="material-symbols-outlined text-yellow-500 mb-1">trophy</span>
                <p className="text-[8px] font-black text-white/40 uppercase">Vitórias</p>
                <p className="font-bold">8</p>
              </div>
            </div>

            {/* Kick Button (Host Only) */}
            {room.host_id === currentUserId && selectedPlayer.userId !== currentUserId && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.confirm(`Deseja remover ${selectedPlayer.name} da mesa?`)) {
                    await reject(selectedPlayer.id);
                    useNotificationStore.getState().show("Jogador removido!", 'success');
                    setSelectedPlayer(null);
                  }
                }}
                className="w-full h-14 bg-red-500/10 text-red-500 font-black rounded-2xl shadow-none mb-4 uppercase text-xs hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
              >
                REMOVER DA MESA
              </button>
            )}

            <button onClick={() => setSelectedPlayer(null)} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20">FECHAR</button>
          </div>
        </div>
      )}
    </div>
  );
};
