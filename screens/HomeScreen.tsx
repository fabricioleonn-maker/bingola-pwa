import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';
import { useRoomStore } from '../state/roomStore';
import { clearBingolaLocalState } from '../state/persist';
import { useTutorialStore } from '../state/tutorialStore';

interface HomeProps {
  onNavigate: (screen: AppScreen) => void;
}

export const HomeScreen: React.FC<HomeProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('Explorador');
  const [balance, setBalance] = useState(0);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  // State derived from Store (removed local state for these)
  const hasActiveRoom = !!useRoomStore((s) => s.roomId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Room state (single source of truth)
  const roomId = useRoomStore((s) => s.roomId);
  const room = useRoomStore((s) => s.room);
  const isHost = room?.host_id === currentUserId;

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getBingoLabel = (num: number): string => {
    if (num <= 0) return "";
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && (error as any).code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              username: user.user_metadata?.username || user.email?.split('@')[0] || 'Usuário',
              bcoins: 100,
              level: 1
            })
            .select()
            .single();
          profile = newProfile as any;
        }

        if (profile) {
          setUserName((profile as any).username || 'Usuário');
          setBalance((profile as any).bcoins || 0);
          setProfileAvatar((profile as any).avatar_url || null);
        }
      }
    };

    fetchProfile();

    // State sync removed - relying on Store directly

    // Auto-start tutorial if never seen
    const { isActive, hasSeenTutorial, startTutorial } = useTutorialStore.getState();
    if (!hasSeenTutorial && !isActive) {
      setTimeout(() => startTutorial(), 2000); // Small delay for splash to end
    }
  }, [roomId]);

  // Derive HUD state from Store
  const isGameRunning = !!roomId && room?.status === 'playing';
  const lastDrawn = isGameRunning && room?.drawn_numbers && room.drawn_numbers.length > 0
    ? room.drawn_numbers[room.drawn_numbers.length - 1]
    : null;

  const handleForceExit = async () => {
    if (window.confirm("Deseja forçar a saída da mesa atual?")) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && roomId) {
          // If host, try to mark room as finished so it doesn't show up in watchdog for anyone
          const { data: roomInfo } = await supabase.from('rooms').select('host_id').eq('id', roomId).single();
          if (roomInfo?.host_id === user.id) {
            await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
          }
          await supabase.from('participants').delete().eq('room_id', roomId).eq('user_id', user.id);
        }
      } catch (err) {
        console.warn("Error force exiting:", err);
      }

      // Clear game states but set a hard block on auto-resume for 1 minute
      localStorage.removeItem('bingola_game_running');
      localStorage.removeItem('bingola_active_room_id');
      localStorage.setItem('bingola_force_no_resume', Date.now().toString());

      useRoomStore.getState().setRoomId(null);
      window.location.reload();
    }
  };

  const handleJoinByCode = async () => {
    setErrorMsg(null);
    if (joinCode.length < 4) {
      setErrorMsg('O código deve ter pelo menos 4 dígitos.');
      return;
    }
    setIsJoining(true);
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, status, name, player_limit')
        .eq('code', joinCode)
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roomError || !roomData) {
        setErrorMsg('Sala não encontrada ou já encerrada.');
        return;
      }

      // 1a. Full Room Check
      const { count: acceptedCount } = await supabase
        .from('participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomData.id)
        .eq('status', 'accepted');

      const limit = roomData.player_limit || 20;
      // Host occupies 1 spot, so we check if (accepted + 1) >= limit
      if (acceptedCount !== null && (acceptedCount + 1) >= limit) {
        setErrorMsg("Mesa já está cheia, entre em contato com o anfitrião");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      // 1b. Ban Check (Unified)
      const { data: banData } = await supabase
        .from('room_bans')
        .select('rejection_count')
        .eq('room_id', roomData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (banData && banData.rejection_count >= 2) {
        setErrorMsg("Você foi banido permanentemente desta mesa.");
        return;
      }

      // 1c. Simple Rejection check REMOVED to allow retry (2-strike rule)
      // The user can try again until they reach 2 rejections (handled by banData check above)

      // 1d. Logic to clear previous states
      useRoomStore.getState().setRoomId(null);
      const keysToRemove = [
        'bingola_game_running',
        'bingola_paused',
        'bingola_last_draw_time',
        'bingola_drawn_numbers',
        'bingola_last_winner'
      ];
      for (const k of keysToRemove) localStorage.removeItem(k);

      // 2. Join the new room
      const { error: partError } = await supabase
        .from('participants')
        .upsert({
          room_id: roomData.id,
          user_id: user.id,
          status: 'pending'
        }, { onConflict: 'room_id,user_id' });

      if (partError) throw partError;

      clearBingolaLocalState();
      useRoomStore.getState().setRoomId(roomData.id);
      onNavigate('participant_lobby');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao entrar na sala.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark pb-32">
      <header className="flex items-center justify-between p-6 pt-10">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">Olá, {userName}! 👋</h2>
          <div className="bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30 w-fit mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary text-[14px]">payments</span>
            <span className="text-[12px] font-black text-white">{balance} BCOINS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => useTutorialStore.getState().startTutorial()}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
          <div id="personalize-btn" className="cursor-pointer" onClick={() => onNavigate('profile')}>
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden">
              {profileAvatar ? (
                <img src={profileAvatar} className="w-full h-full rounded-full object-cover" alt="Profile" />
              ) : (
                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/20 text-xl">person</span>
                </div>
              )}
            </div>
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
          {/* 1. Return to Active Room Card */}
          {hasActiveRoom && (
            <button
              onClick={() => isGameRunning ? onNavigate('game') : onNavigate(isHost ? 'lobby' : 'participant_lobby')}
              className="flex flex-col items-center justify-center h-48 bg-gradient-to-br from-primary to-pink-600 rounded-3xl shadow-xl relative overflow-hidden group active:scale-95 transition-all w-full animate-in zoom-in-50 duration-300"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16"></div>

              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4 ring-4 ring-white/10">
                <span className="material-symbols-outlined text-white text-4xl animate-pulse">
                  {isGameRunning ? 'play_circle' : 'meeting_room'}
                </span>
              </div>
              <span className="text-white font-black text-2xl uppercase tracking-tight italic">
                {isGameRunning ? 'Voltar ao Jogo' : 'Abrir Lobby'}
              </span>
              <span className="text-white/80 text-[10px] uppercase font-bold tracking-widest mt-2 bg-black/20 px-3 py-1 rounded-full">
                {isGameRunning ? 'Partida em Andamento' : 'Sua mesa está ativa'}
              </span>
            </button>
          )}

          {/* 2. Create New Room (Blocked if active) */}
          <button
            id="create-room-btn"
            onClick={() => {
              if (hasActiveRoom) {
                alert("Você já está em uma mesa ativa! Saia dela primeiro ou clique em 'Abrir Lobby'.");
                return;
              }
              onNavigate('host_dashboard');
            }}
            className={`flex flex-col items-center justify-center h-48 rounded-3xl shadow-xl relative overflow-hidden group active:scale-95 transition-all ${hasActiveRoom ? 'bg-white/5 border border-white/5 opacity-50 grayscale cursor-not-allowed' : 'bg-surface-dark border border-white/10'}`}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-white text-3xl">add</span>
            </div>
            <span className="text-white font-bold text-lg">Criar Nova Sala</span>
            <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mt-1">Sorteio em grupo</span>
          </button>

          {/* 3. Join Room (Blocked if active) */}
          <button
            id="join-personalize-section"
            onClick={() => {
              if (hasActiveRoom) {
                alert("Você já está em uma mesa ativa! Saia dela primeiro ou clique em 'Abrir Lobby'.");
                return;
              }
              setErrorMsg(null);
              setShowJoinModal(true);
            }}
            className={`flex flex-col items-center justify-center h-48 rounded-3xl group active:scale-95 transition-transform ${hasActiveRoom ? 'bg-white/5 border border-white/5 opacity-50 grayscale cursor-not-allowed' : 'bg-surface-dark border border-white/10'}`}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">keyboard</span>
            </div>
            <span className="text-white font-bold text-lg">Entrar com Código</span>
          </button>
        </div>

        {showJoinModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16"></div>

              <h3 className="text-2xl font-black text-center mb-2 italic">Entrar na Mesa</h3>
              <p className="text-white/40 text-[10px] text-center font-black uppercase tracking-widest mb-8">Digite o PIN de 4 dígitos</p>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                id="join-code-input"
                className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl text-center text-4xl font-black tracking-[0.5em] text-primary focus:border-primary/50 focus:ring-0 transition-all mb-8 placeholder:opacity-10"
                autoFocus
              />

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 animate-pulse">
                  <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">{errorMsg}</p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleJoinByCode}
                  disabled={isJoining || joinCode.length < 4}
                  className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all italic"
                >
                  {isJoining ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">login</span>
                      ENTRAR AGORA
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setShowJoinModal(false); setJoinCode(''); }}
                  className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl hover:bg-white/10 transition-colors"
                >
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        )}

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

        {hasActiveRoom && (
          <button
            onClick={handleForceExit}
            className="w-full py-4 text-white/30 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-2xl hover:bg-white/5 transition-colors"
          >
            Problemas com a mesa? Sair agora
          </button>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-4 px-6 z-50">
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
