import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';
import { useRoomStore } from '../state/roomStore';
import { useNotificationStore } from '../state/notificationStore';
import { clearBingolaLocalState } from '../state/persist';
import { useTutorialStore } from '../state/tutorialStore';
import { useInvitationStore } from '../state/invitationStore';
import QRScanner from '../components/QRScanner';
import { useUserStore } from '../state/userStore';
import { useUILabels } from '../state/uiLabelsStore';
import { EditableElement } from '../components/EditableElement';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HomeProps {
  onNavigate: (screen: AppScreen) => void;
}

export const HomeScreen: React.FC<HomeProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('Explorador');
  const { profile, refreshProfile, setEditingElement } = useUserStore();
  const { getLabel } = useUILabels();
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  // State derived from Store (removed local state for these)
  const hasActiveRoom = !!useRoomStore((s) => s.roomId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Room state (single source of truth)
  const roomId = useRoomStore((s) => s.roomId);
  const room = useRoomStore((s) => s.room);
  const isHost = room?.host_id === currentUserId;

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
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
      await refreshProfile();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchHistory(user.id);
      }
    };

    const fetchHistory = async (userId: string) => {
      const { data } = await supabase
        .from('participants')
        .select('room_id, rooms!inner(name, status, created_at)')
        .eq('user_id', userId)
        .eq('rooms.status', 'finished')
        .order('created_at', { foreignTable: 'rooms', ascending: false })
        .limit(5);

      if (data) setHistory(data.map(d => ({ name: (d as any).rooms.name, id: d.room_id })));
    };

    fetchProfile();

    // State sync removed - relying on Store directly

    // Auto-start tutorial if never seen
    const { isActive, hasSeenTutorial, startTutorial } = useTutorialStore.getState();
    if (!hasSeenTutorial && !isActive) {
      setTimeout(() => startTutorial(), 2000); // Small delay for splash to end
    }

    // Poll for invites
    const { fetchIncoming } = useInvitationStore.getState();
    fetchIncoming();
    const inviteInterval = setInterval(fetchIncoming, 10000);

    return () => clearInterval(inviteInterval);
  }, [roomId]);

  // Sync Profile Data
  useEffect(() => {
    if (profile) {
      setUserName(profile.username || 'Explorador');
      setProfileAvatar(profile.avatar_url);
    }
  }, [profile]);

  const { incoming, respondToInvite } = useInvitationStore();
  const { isInstallable, installApp } = usePWAInstall();

  // Derive HUD state from Store
  const isGameRunning = !!roomId && room?.status === 'playing';
  const lastDrawn = isGameRunning && room?.drawn_numbers && room.drawn_numbers.length > 0
    ? room.drawn_numbers[room.drawn_numbers.length - 1]
    : null;

  const handleForceExit = async () => {
    useNotificationStore.getState().confirm({
      title: "Encerrar Mesa?",
      message: "Deseja forçar a saída da mesa atual? Esta ação é irreversível.",
      onConfirm: async () => {
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
    });
  };

  const handleQRScan = (decodedText: string) => {
    // Expected format: ...?join=1234&trusted=1
    let code = '';
    let isTrusted = false;

    if (decodedText.includes('join=')) {
      const url = new URL(decodedText);
      code = url.searchParams.get('join') || '';
      isTrusted = url.searchParams.get('trusted') === '1';
    } else {
      const match = decodedText.match(/\d{4}/);
      if (match) code = match[0];
    }

    if (code.length === 4) {
      setJoinCode(code);
      setShowQRScanner(false);
      setTimeout(() => {
        handleJoinByCode(code, isTrusted);
      }, 500);
    } else {
      useNotificationStore.getState().show("Código inválido no QR", 'error');
    }
  };

  const handleJoinByCode = async (forcedCodeOrEvent?: any, qrTrusted?: boolean) => {
    // If called by onClick, forcedCodeOrEvent is a React synthetic event
    const codeToJoin = (typeof forcedCodeOrEvent === 'string' ? forcedCodeOrEvent : null) || joinCode;
    const isActuallyTrusted = qrTrusted || false;

    setErrorMsg(null);
    if (codeToJoin.length < 4) {
      setErrorMsg('O código deve ter pelo menos 4 dígitos.');
      return;
    }
    setIsJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Dual Device / Session Protection
      const { data: activeMembership } = await supabase
        .from('participants')
        .select('room_id, rooms!inner(status, name)')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .neq('rooms.status', 'finished')
        .maybeSingle();

      if (activeMembership && (!roomId || activeMembership.room_id !== roomId)) {
        // IMPROVEMENT: Instead of blocking, automatically exit the old room to let the user join the new one
        console.log(`[Join] Auto-cleaning old room: ${activeMembership.room_id}`);
        await useRoomStore.getState().hardExit(activeMembership.room_id, user.id);
      }

      // ... rest of the logic ...
      // 2. Room Discovery
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, status, name, player_limit')
        .eq('code', codeToJoin)
        .in('status', ['lobby', 'playing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roomError || !roomData) throw new Error('Mesa não encontrada ou encerrada.');

      // ... player limit and ban checks ...
      const { count: acceptedCount } = await supabase
        .from('participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomData.id)
        .eq('status', 'accepted');

      const limit = roomData.player_limit || 20;
      if (acceptedCount !== null && (acceptedCount + 1) >= limit) {
        throw new Error('Mesa cheia.');
      }

      const { data: banData } = await supabase
        .from('room_bans')
        .select('rejection_count')
        .eq('room_id', roomData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (banData && banData.rejection_count >= 2) {
        throw new Error("Você foi banido permanentemente desta mesa.");
      }

      // 1d. Logic to clear previous states - ONLY if needed
      // useRoomStore.getState().setRoomId(null); // REDUNDANT: bootstrap handles this
      // clearBingolaLocalState(); // REDUNDANT: handled by room logic

      // 2. Join the new room
      if (isActuallyTrusted) {
        await useRoomStore.getState().joinRoomWithStatus(roomData.id, user.id, 'accepted');
        useNotificationStore.getState().show("Entrada autorizada!", 'success');
      } else {
        await useRoomStore.getState().joinRoomWithStatus(roomData.id, user.id, 'pending');
      }

      // HYDRATION: Vital to prevent "black screen" (race condition)
      console.log(`[Join] Hydrating store for room: ${roomData.id}`);
      await useRoomStore.getState().bootstrap(roomData.id);
      await useRoomStore.getState().refreshParticipants(roomData.id);

      useRoomStore.getState().setRoomId(roomData.id);

      // ENSURE navigation happens AFTER state is fully updated
      setTimeout(() => {
        setShowJoinModal(false);
        // REDIRECT LOGIC
        if (roomData.status === 'playing' && isActuallyTrusted) {
          onNavigate('game');
        } else {
          onNavigate('participant_lobby');
        }
      }, 100);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao entrar na sala.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-dark text-white font-sans overflow-hidden relative">
      {/* Invitation Overlay */}
      {incoming?.length > 0 && (
        <div className="fixed top-24 left-4 right-4 z-[1001] animate-in slide-in-from-top duration-500">
          <div className="bg-primary/95 backdrop-blur-xl p-5 rounded-[2rem] border border-white/20 shadow-[0_20px_50px_rgba(255,61,113,0.3)] flex items-center gap-4">
            <div className="size-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              <span className="material-symbols-outlined text-white animate-bounce">celebration</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Convite de Jogo!</p>
              <h4 className="font-black italic text-white text-xs leading-tight">
                <span className="text-white/40">@{incoming[0].host_name}</span> te convidou para <span className="text-white">{incoming[0].room_name}</span>
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respondToInvite(incoming[0].id, 'rejected')}
                className="size-10 bg-black/20 rounded-xl flex items-center justify-center text-white/40 border border-white/10 active:scale-90 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <button
                onClick={async () => {
                  const inv = incoming[0];
                  await respondToInvite(inv.id, 'accepted');
                  // Fetch room code
                  const { data } = await supabase.from('rooms').select('code').eq('id', inv.room_id).single();
                  if (data) handleJoinByCode(data.code, true);
                }}
                className="h-10 px-4 bg-white text-primary font-black text-[10px] rounded-xl shadow-lg uppercase active:scale-95 transition-all"
              >
                ACEITAR
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between p-6 pt-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">Olá, {userName}! 👋</h2>
          <div className="bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30 w-fit mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary text-[14px]">payments</span>
            <span className="text-[12px] font-black text-white">{profile?.bcoins || 0} BCOINS</span>
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
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="Profile" />
              ) : (
                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/20 text-xl">person</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-6 overflow-y-auto pb-32 no-scrollbar">
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
          <EditableElement id="btn_home_create" text="Criar Nova Sala" onEdit={setEditingElement} className="flex-1">
            <button
              id="create-room-btn"
              onClick={() => {
                if (hasActiveRoom) {
                  useNotificationStore.getState().show("Você já está em uma mesa ativa! Saia dela primeiro ou clique em 'Abrir Lobby'.", 'info');
                  return;
                }
                onNavigate('host_dashboard');
              }}
              className={`flex flex-col items-center justify-center h-48 rounded-3xl shadow-xl relative overflow-hidden group active:scale-95 transition-all ${hasActiveRoom ? 'bg-white/5 border border-white/5 opacity-50 grayscale cursor-not-allowed' : 'bg-surface-dark border border-white/10'}`}
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-white text-3xl">add</span>
              </div>
              <span className="text-white font-bold text-lg">{getLabel('btn_home_create', 'Criar Nova Sala')}</span>
              <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mt-1">Sorteio em grupo</span>
            </button>
          </EditableElement>

          {/* 3. Join Room (Blocked if active) */}
          <EditableElement id="btn_home_join" text="Entrar com Código" onEdit={setEditingElement} className="flex-1">
            <button
              id="join-personalize-section"
              onClick={() => {
                if (hasActiveRoom) {
                  useNotificationStore.getState().show("Você já está em uma mesa ativa! Saia dela primeiro ou clique em 'Abrir Lobby'.", 'info');
                  return;
                }
                setErrorMsg(null);
                setShowJoinModal(true);
              }}
              className={`w-full flex flex-col items-center justify-center h-48 rounded-3xl group active:scale-95 transition-transform ${hasActiveRoom ? 'bg-white/5 border border-white/5 opacity-50 grayscale cursor-not-allowed' : 'bg-surface-dark border border-white/10'}`}
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">keyboard</span>
              </div>
              <span className="text-white font-bold text-lg">{getLabel('btn_home_join', 'Entrar com Código')}</span>
            </button>
          </EditableElement>

          {/* 4. Install PWA Button */}
          {isInstallable && (
            <button
              onClick={installApp}
              className="flex flex-col items-center justify-center h-48 bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl shadow-xl relative overflow-hidden group active:scale-95 transition-all w-full animate-in zoom-in-50 duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4 ring-4 ring-white/10">
                <span className="material-symbols-outlined text-white text-3xl animate-bounce">download</span>
              </div>
              <span className="text-white font-black text-lg uppercase tracking-tight">Instalar App</span>
              <span className="text-white/80 text-[10px] uppercase font-bold tracking-widest mt-2 bg-black/20 px-3 py-1 rounded-full">
                Melhor Experiência
              </span>
            </button>
          )}

          {/* DEBUG PWA INFO (Temporary) */}
          <div className="bg-black/40 p-2 rounded text-[8px] font-mono text-white/50 text-center">
            PWA Status: {isInstallable ? 'PRONTO' : 'Ag. Evento'} <br />
            SW Support: {'serviceWorker' in navigator ? 'SIM' : 'NÃO'} <br />
            Display: {window.matchMedia('(display-mode: standalone)').matches ? 'STANDALONE' : 'BROWSER'}
          </div>
        </div>

        {
          showJoinModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16"></div>

                <h3 className="text-2xl font-black text-center mb-2 italic">Entrar na Mesa</h3>
                <p className="text-white/40 text-[10px] text-center font-black uppercase tracking-widest mb-8">Digite o PIN de 4 dígitos</p>

                <div className="relative group mb-8">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    id="join-code-input"
                    className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl text-center text-4xl font-black tracking-[0.5em] text-primary focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-10"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowQRScanner(true)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 size-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined">qr_code_scanner</span>
                  </button>
                </div>

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
          )
        }

        {
          showQRScanner && (
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setShowQRScanner(false)}
            />
          )
        }

        <section>
          <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4">Histórico de Mesas</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {history.length === 0 ? (
              <div className="w-full h-24 flex items-center justify-center border border-white/5 rounded-2xl bg-white/5">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Nenhuma partida finalizada</p>
              </div>
            ) : history.map((item, i) => (
              <div key={i} className="flex-none p-4 w-40 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-3 active:scale-95 transition-all">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">history</span>
                </div>
                <div className="text-center w-full">
                  <p className="font-black text-xs truncate w-full">{item.name}</p>
                  <p className="text-[9px] font-bold text-white/20 uppercase mt-1">Finalizada</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {
          hasActiveRoom && (
            <button
              onClick={handleForceExit}
              className="w-full py-4 text-white/30 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-2xl hover:bg-white/5 transition-colors"
            >
              Problemas com a mesa? Sair agora
            </button>
          )
        }
      </main >

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] px-2 z-50">
        <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined fill-1">home</span>
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
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-[10px] font-bold">Loja</span>
        </button>
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-white/40">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>
    </div >
  );
};
