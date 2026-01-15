
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';
import { AppScreen } from '../types';

interface Props {
  roomInfo: any;
  onBack: () => void;
  onWin: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const GameScreen: React.FC<Props> = ({ roomInfo: propRoomInfo, onBack, onWin, onNavigate }) => {
  const room = useRoomStore(s => s.room);
  const roomId = useRoomStore(s => s.roomId);
  const acceptedFromStore = useRoomStore(s => s.accepted);

  const [grid, setGrid] = useState<number[][]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimedPrizes, setClaimedPrizes] = useState<any[]>([]);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<any>(null);
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isPaused, setIsPaused] = useState(localStorage.getItem('bingola_is_paused') === 'true');
  const [isDrawing, setIsDrawing] = useState(false);
  const [assistMode, setAssistMode] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  const winnerChannelRef = useRef<any>(null);
  const finishedAlertedRef = useRef(false);

  // --- Logic helpers ---
  const generateGrid = useMemo(() => () => {
    const cols: number[][] = [];
    const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
    for (let i = 0; i < 5; i++) {
      const col = [];
      const [min, max] = ranges[i];
      const pool = Array.from({ length: max - min + 1 }, (_, k) => k + min);
      for (let j = 0; j < 5; j++) {
        const idx = Math.floor(Math.random() * pool.length);
        col.push(pool.splice(idx, 1)[0]);
      }
      cols.push(col.sort((a, b) => a - b));
    }
    cols[2][2] = 0; // FREE
    const result = [];
    for (let r = 0; r < 5; r++) {
      result.push([cols[0][r], cols[1][r], cols[2][r], cols[3][r], cols[4][r]]);
    }
    return result;
  }, []);

  const drawnNumbers = room?.drawn_numbers || [];
  const roomInfo = room || propRoomInfo;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setCurrentUserProfile(profile);
      }
    });

    const settings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    setAssistMode(!!settings.assistMode);

    const handleStorage = () => {
      setIsPaused(localStorage.getItem('bingola_is_paused') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const hostId = (roomInfo as any)?.host_id ?? (roomInfo as any)?.hostId;
  const isHost = !!currentUserId && !!hostId && currentUserId === hostId;
  const roundNumber = roomInfo?.current_round || 1;
  const totalRounds = roomInfo?.rounds || 1;

  const storageKeyBase = roomId ? `bingola:${roomId}:${currentUserId || 'anon'}:${roundNumber}` : null;
  const gridKey = storageKeyBase ? `${storageKeyBase}:grid` : 'bingola_player_grid';
  const markedKey = storageKeyBase ? `${storageKeyBase}:marked` : 'bingola_player_marked';
  const claimedKey = storageKeyBase ? `${storageKeyBase}:claimed_prizes` : 'bingola_claimed_prizes';

  // Use a ref to track if we already loaded a grid for a specific key
  // This prevents regeneration if re-renders happen with same key
  const loadedGridKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // If we already loaded this exact key, do nothing unless grid is empty
    if (loadedGridKeyRef.current === gridKey && grid.length > 0) return;

    const savedGrid = localStorage.getItem(gridKey);
    if (savedGrid) {
      setGrid(JSON.parse(savedGrid));
    } else {
      // Only generate if we don't have a saved one
      const newGrid = generateGrid();
      setGrid(newGrid);
      localStorage.setItem(gridKey, JSON.stringify(newGrid));
    }

    loadedGridKeyRef.current = gridKey;

    setMarked(JSON.parse(localStorage.getItem(markedKey) || '[]'));
    setClaimedPrizes(JSON.parse(localStorage.getItem(claimedKey) || '[]'));
  }, [gridKey, markedKey, claimedKey, generateGrid]);

  // Fix: Sync local timer when new numbers arrive (for participants)
  useEffect(() => {
    if (!isHost && drawnNumbers.length > 0) {
      localStorage.setItem('bingola_last_draw_time', Date.now().toString());
    }
  }, [drawnNumbers.length, isHost]);

  useEffect(() => {
    if (room?.status === 'finished' && !finishedAlertedRef.current) {
      finishedAlertedRef.current = true;
      alert('A mesa foi encerrada pelo anfitrião.');
      localStorage.removeItem('bingola_last_winner');
      localStorage.setItem('bingola_is_paused', 'false');
      setWinnerAnnouncement(null);
      onBack();
    }
  }, [room?.status, onBack]);

  // Handle Join Requests for Host
  useEffect(() => {
    if (!isHost || !roomId) return;
    const fetchRequests = async () => {
      const { data } = await supabase.from('participants').select('*, profiles(username, avatar_url)').eq('room_id', roomId).eq('status', 'pending');
      if (data) setPendingRequests(data.map(p => ({
        id: p.user_id,
        participant_id: p.id,
        name: p.profiles?.username || 'Jogador',
        avatar: p.profiles?.avatar_url
      })));
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, [isHost, roomId]);

  // Realtime winners & resume events
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`room_events:${roomId}`)
      .on('broadcast', { event: 'winner' }, (payload) => {
        setWinnerAnnouncement(payload.payload);
        setIsPaused(true);
        setClaimedPrizes(prev => {
          const exists = prev.some(p => p.type === payload.payload.type && p.winner_id === payload.payload.winner_id);
          if (exists) return prev;
          const newList = [...prev, payload.payload];
          localStorage.setItem(claimedKey, JSON.stringify(newList));
          return newList;
        });
        localStorage.setItem('bingola_is_paused', 'true');
        localStorage.setItem('bingola_last_winner', JSON.stringify(payload.payload));
      })
      .on('broadcast', { event: 'resume' }, () => {
        setWinnerAnnouncement(null);
        setIsPaused(false);
        localStorage.setItem('bingola_is_paused', 'false');
        localStorage.removeItem('bingola_last_winner');
      })
      .subscribe();

    const interval = setInterval(() => {
      useRoomStore.getState().refreshParticipants(roomId);
    }, 5000);

    winnerChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [roomId, claimedKey]);

  // Sync timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused || (winnerAnnouncement && !isHost)) return;
      const lastDraw = Number(localStorage.getItem('bingola_last_draw_time') || Date.now());
      const drawDelay = (roomInfo as any)?.draw_interval || 12;
      const elapsed = Math.floor((Date.now() - lastDraw) / 1000);
      const remaining = Math.max(0, drawDelay - elapsed);
      setTimeLeft(remaining);

      // Host executes the draw
      if (isHost && remaining === 0 && !isPaused && !winnerAnnouncement && !isDrawing) {
        drawNumber();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, isPaused, roomInfo?.draw_interval, winnerAnnouncement, isDrawing]);

  const drawNumber = async () => {
    if (!isHost || isPaused || winnerAnnouncement || isDrawing) return;

    // Safety: check if already drawn recently
    const lastDraw = Number(localStorage.getItem('bingola_last_draw_time') || 0);
    if (Date.now() - lastDraw < 1500) return;

    const pool = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !drawnNumbers.includes(n));
    if (pool.length === 0) return;

    setIsDrawing(true);
    try {
      const lucky = pool[Math.floor(Math.random() * pool.length)];
      const newList = [...drawnNumbers, lucky];

      localStorage.setItem('bingola_last_draw_time', Date.now().toString());

      const { error } = await supabase
        .from('rooms')
        .update({
          drawn_numbers: newList,
          // Update the draw time in DB so others sync their local timer
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId);

      if (error) throw error;
    } catch (err) {
      console.error("Error drawing number:", err);
    } finally {
      setIsDrawing(false);
    }
  };

  const markNumber = async (num: number) => {
    if (num !== 0 && !drawnNumbers.includes(num)) return;
    if (marked.includes(num)) return;
    const newMarked = [...marked, num];
    setMarked(newMarked);
    localStorage.setItem(markedKey, JSON.stringify(newMarked));
  };

  const handleBingo = async () => {
    const isMarked = (n: number) => n === 0 || marked.includes(n);
    const patterns = (roomInfo as any)?.winning_patterns || { cheia: true };

    let winType = null;
    let isFullCard = false;

    if (grid.flat().every(isMarked)) {
      winType = "Cartela Cheia";
      isFullCard = true;
    }
    else if (!claimedPrizes.some(p => p.type !== 'Cartela Cheia')) {
      if (patterns.cinquina) {
        for (let r = 0; r < 5; r++) if (grid[r].every(isMarked)) winType = "Cinquina";
      }
      if (!winType && patterns.cantos) {
        if ([grid[0][0], grid[0][4], grid[4][0], grid[4][4]].every(isMarked)) winType = "Cantos";
      }
      if (!winType && patterns.x) {
        const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
        const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
        if (d1.every(isMarked) && d2.every(isMarked)) winType = "Cartela em X";
      }
    }

    if (!winType) {
      setErrorMsg("VOCÊ AINDA NÃO GANHOU ESPERTINHO! CONTINUE MARCANDO");
      setTimeout(() => setErrorMsg(null), 2000);
      return;
    }

    const potRaw = roomInfo?.prize_pool || roomInfo?.prizePool || roomInfo?.prize_pot || roomInfo?.bpoints || 0;
    const pot = Number(potRaw);
    const prizeValue = isFullCard ? Math.floor(pot * 0.7) : Math.floor(pot * 0.3);

    // Calculate winning numbers
    let winningNumbers: number[] = [];
    if (winType === 'Cartela Cheia') {
      winningNumbers = grid.flat().filter(n => n !== 0 && marked.includes(n));
    } else if (winType === 'Cinquina') {
      for (let r = 0; r < 5; r++) {
        if (grid[r].every(isMarked)) winningNumbers = grid[r].filter(n => n !== 0);
      }
    } else if (winType === 'Cantos') {
      const corners = [grid[0][0], grid[0][4], grid[4][0], grid[4][4]];
      winningNumbers = corners.filter(n => n !== 0);
    } else if (winType === 'Cartela em X') {
      const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
      const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
      // unique numbers
      winningNumbers = [...new Set([...d1, ...d2])].filter(n => n !== 0);
    }

    const winData = {
      winner: currentUserProfile?.username || 'Jogador',
      winner_id: currentUserId,
      type: winType,
      value: prizeValue,
      pot,
      round: roundNumber,
      winningNumbers,
      ts: Date.now()
    };

    if (winnerChannelRef.current) {
      winnerChannelRef.current.send({
        type: 'broadcast',
        event: 'winner',
        payload: winData
      });
    }

    // Set local state so the winner also sees the announcement
    setWinnerAnnouncement(winData);
    setIsPaused(true);
    localStorage.setItem('bingola_is_paused', 'true');
    localStorage.setItem('bingola_last_winner', JSON.stringify(winData));
  };

  const togglePause = () => {
    const newVal = !isPaused;

    // If resuming while a winner announcement is active, clear it for everyone
    if (!newVal && winnerAnnouncement && isHost) {
      if (winnerChannelRef.current) {
        winnerChannelRef.current.send({
          type: 'broadcast',
          event: 'resume'
        });
      }
      setWinnerAnnouncement(null);
    }

    localStorage.setItem('bingola_is_paused', String(newVal));
    setIsPaused(newVal);
    if (!newVal) localStorage.removeItem('bingola_last_winner');
  };

  const handleFinish = async () => {
    if (window.confirm("Encerrar esta mesa definitivamente?")) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
      onBack();
    }
  };

  const handleNextRound = async () => {
    const next = roundNumber + 1;
    // Set status to 'waiting' to redirect everyone to Lobby (based on App.tsx logic)
    // Set status to 'waiting' to redirect everyone to Lobby (based on App.tsx logic)
    await supabase.from('rooms').update({ current_round: next, status: 'waiting', drawn_numbers: [] }).eq('id', roomId);
    localStorage.removeItem('bingola_last_winner');
    localStorage.setItem('bingola_is_paused', 'false');
    setWinnerAnnouncement(null);
  };

  const handleAuthorize = async (pId: string, allow: boolean) => {
    if (allow) await supabase.from('participants').update({ status: 'accepted' }).eq('id', pId);
    else await supabase.from('participants').update({ status: 'rejected' }).eq('id', pId);
  };

  const getBingoLabel = (n: number) => {
    if (n <= 15) return 'B';
    if (n <= 30) return 'I';
    if (n <= 45) return 'N';
    if (n <= 60) return 'G';
    return 'O';
  };

  const custom = JSON.parse(localStorage.getItem('bingola_card_custom') || '{"selectedTheme":"classic","cardColor":"#FF3D71","stampIcon":"star","opacity":100}');
  const theme = {
    retro: { cardBg: 'bg-[#f0e6d2]', cellBg: 'bg-white', textColor: 'text-[#4a3a2a]', border: 'border-[#d6ccb8]' },
    classic: { cardBg: 'bg-surface-dark', cellBg: 'bg-white/5', textColor: 'text-white', border: 'border-white/10' },
    neon: { cardBg: 'bg-[#0a0a0a]', cellBg: 'bg-[#1a1a1a]', textColor: 'text-white/90', border: 'border-primary/20' },
    minimal: { cardBg: 'bg-white', cellBg: 'bg-gray-50', textColor: 'text-zinc-800', border: 'border-gray-100' }
  }[custom.selectedTheme as string] || { cardBg: 'bg-surface-dark', cellBg: 'bg-white/5', textColor: 'text-white', border: 'border-white/10' };

  const lastNum = drawnNumbers[drawnNumbers.length - 1] || null;

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white overflow-hidden relative">
      <header className="p-4 border-b border-white/5 flex items-center justify-between bg-background-dark/95 backdrop-blur-md sticky top-0 z-50">
        <button onClick={onBack} className="size-10 flex items-center"><span className="material-symbols-outlined">chevron_left</span></button>
        <div className="text-center flex-1">
          <h2 className="text-[10px] font-black opacity-30 uppercase tracking-widest">{roomInfo?.name || 'Mesa Ativa'}</h2>
          <p className="text-xs font-black text-primary italic leading-none">RODADA {roundNumber}/{totalRounds}</p>
        </div>
        <div className="flex items-center gap-1">
          {isHost && (
            <button onClick={() => setShowAuthModal(true)} className="size-10 flex items-center justify-center text-primary relative">
              <span className="material-symbols-outlined">person_add</span>
              {pendingRequests.length > 0 && <div className="absolute top-2 right-2 size-2 bg-red-500 rounded-full animate-ping"></div>}
            </button>
          )}
          <button onClick={() => setShowRulesInfo(true)} className="size-10 flex items-center justify-center text-white/30"><span className="material-symbols-outlined">info</span></button>
          {isHost && (
            <>
              <button onClick={togglePause} className="size-10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">{isPaused ? 'play_arrow' : 'pause'}</span>
              </button>
              <button onClick={handleFinish} className="size-10 flex items-center justify-center text-red-500/80">
                <span className="material-symbols-outlined">power_settings_new</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center space-y-6 overflow-y-auto pb-40">
        <div className="text-center flex flex-col items-center w-full">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">
            {isPaused ? 'SORTEIO PAUSADO' : `PRÓXIMO EM ${timeLeft}S`}
          </p>
          <div className="size-64 bg-white rounded-full flex flex-col items-center justify-center shadow-[0_0_120px_rgba(255,61,113,0.3)] border-[12px] border-primary relative">
            {lastNum && (
              <span className="text-primary font-black text-2xl absolute top-8 animate-pulse">{getBingoLabel(lastNum)}</span>
            )}
            <span className="text-zinc-900 text-[120px] font-black leading-none tabular-nums mt-4">
              {lastNum || '--'}
            </span>
          </div>
        </div>

        {/* Últimas Bolas */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-2 px-1">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Últimas Bolas</p>
            <span className="text-xs font-black text-primary">{drawnNumbers.length}/75</span>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-3 px-1">
            {[...drawnNumbers].reverse().map((n, i) => (
              <div key={i} className={`flex-none size-16 rounded-2xl flex flex-col items-center justify-center font-black border transition-all ${i === 0 ? 'bg-primary border-primary scale-110 shadow-lg' : 'bg-white/5 border-white/10 text-white/30'}`}>
                <span className="text-[10px] leading-none mb-1 opacity-60 mt-1">{getBingoLabel(n)}</span>
                <span className="text-2xl leading-none mb-1">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl border-8 ${theme.cardBg} ${theme.border}`}>
          <div className="h-12 flex items-center justify-around" style={{ backgroundColor: custom.cardColor }}>
            {['B', 'I', 'N', 'G', 'O'].map(l => <span key={l} className="text-white font-black text-2xl">{l}</span>)}
          </div>
          <div className="grid grid-cols-5 gap-1.5 p-2.5">
            {grid.flat().map((num, i) => {
              const isDrawn = num === 0 || drawnNumbers.includes(num);
              const isMarked = marked.includes(num);
              const assist = assistMode && isDrawn && !isMarked && num !== 0;
              return (
                <button
                  key={i}
                  onClick={() => markNumber(num)}
                  disabled={!isDrawn}
                  className={`aspect-square rounded-xl flex items-center justify-center relative border transition-all ${num === 0 ? 'bg-primary/10 border-primary/20' : (isMarked ? 'bg-white/5 border-white/10' : `${theme.cellBg} ${theme.border} ${theme.textColor}`)} ${(assistMode && !isDrawn) ? 'opacity-30' : ''} ${assist ? 'ring-2 ring-primary ring-inset ring-offset-2 animate-pulse' : ''}`}
                >
                  {num === 0 ? (
                    <span className="text-[6px] font-black text-primary text-center leading-tight">BINGOLA<br />LIVRE</span>
                  ) : (
                    <span className={`text-lg font-black ${isMarked ? 'opacity-20' : ''}`}>{num}</span>
                  )}
                  {isMarked && num !== 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: custom.opacity / 100 }}>
                      <span className="material-symbols-outlined text-3xl" style={{ color: custom.cardColor }}>{custom.stampIcon}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={handleBingo} className="w-full h-24 bg-primary text-white font-black text-5xl rounded-[3rem] shadow-2xl active:scale-95 transition-all italic tracking-tighter">BINGO!</button>

        {(() => {
          const potRaw = roomInfo?.prize_pool || roomInfo?.prizePool || roomInfo?.prize_pot || roomInfo?.bpoints || 0;
          const pot = Number(potRaw);
          return (
            <div className="w-full max-w-sm space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">30% DO POTE DA RODADA</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-sm text-white">
                      {claimedPrizes.find(p => p.type !== 'Cartela Cheia')?.type || 'Prêmio Secundário'}
                    </p>
                    <p className="text-[10px] font-bold text-white/40">
                      {claimedPrizes.find(p => p.type !== 'Cartela Cheia')?.winner ? `Vencedor: ${claimedPrizes.find(p => p.type !== 'Cartela Cheia').winner}` : 'Aguardando vencedor...'}
                    </p>
                  </div>
                  <p className="font-black text-green-500">B$ {Math.floor(pot * 0.3)}</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">70% DO POTE DA RODADA</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-sm text-white">Cartela Cheia</p>
                    <p className="text-[10px] font-bold text-white/40">
                      {claimedPrizes.find(p => p.type === 'Cartela Cheia')?.winner ? `Vencedor: ${claimedPrizes.find(p => p.type === 'Cartela Cheia').winner}` : 'Boa sorte! 🧿'}
                    </p>
                  </div>
                  <p className="font-black text-green-500">B$ {Math.floor(pot * 0.7)}</p>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {errorMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-6">
          <div className="bg-red-500 text-white px-8 py-4 rounded-full font-black text-sm uppercase shadow-[0_0_50px_rgba(239,68,68,0.5)] animate-bounce text-center">
            {errorMsg}
          </div>
        </div>
      )}

      {showRulesInfo && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowRulesInfo(false)}>
          <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowRulesInfo(false)} className="absolute top-6 right-6 text-white/40"><span className="material-symbols-outlined">close</span></button>
            <div className="mb-6">
              <h3 className="text-xl font-black text-white italic leading-tight uppercase">Regras da Mesa</h3>
              <p className="text-primary font-black text-xs tracking-[0.2em] italic">CÓD MESA: {roomInfo.code}</p>
            </div>
            <div className="space-y-3">
              {Object.entries((roomInfo as any)?.winning_patterns || { cheia: true }).filter(([_, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl capitalize">
                  <span className="material-symbols-outlined text-primary">verified</span>
                  <p className="font-bold text-sm text-white">{k === 'cheia' ? 'Cartela Cheia' : k}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black text-center mb-6 italic text-primary uppercase tracking-widest">Autorizar Jogador</h3>
            <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest pl-1">Solicitações Pendentes</p>
                  {pendingRequests.map(p => (
                    <div key={p.participant_id} className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full border border-primary/20" />
                        <span className="font-bold text-sm">{p.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAuthorize(p.participant_id, false)} className="size-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                        <button onClick={() => handleAuthorize(p.participant_id, true)} className="size-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">check</span></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1 mt-4">Jogadores na Rodada</p>
                {acceptedFromStore.length === 0 ? (
                  <p className="text-center text-white/30 text-[10px] py-4 italic">Nenhum outro jogador.</p>
                ) : acceptedFromStore.map(p => (
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
            <button onClick={() => setShowAuthModal(false)} className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl uppercase">Fechar</button>
          </div>
        </div>
      )}

      {winnerAnnouncement && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-surface-dark w-full max-w-sm p-10 rounded-[3.5rem] border-2 border-primary shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>

            {winnerAnnouncement.winner_id === currentUserId ? (
              // WINNER VIEW
              <>
                <div className="size-24 bg-primary/20 rounded-[2rem] mx-auto flex items-center justify-center mb-8 rotate-[15deg] border-2 border-primary/30">
                  <span className="material-symbols-outlined text-primary text-5xl">workspace_premium</span>
                </div>
                <p className="text-primary font-black text-[10px] uppercase tracking-[0.4em] mb-4">PARABÉNS! VOCÊ GANHOU!</p>
                <h3 className="text-6xl font-black italic text-white mb-6 leading-none tracking-tighter uppercase">{winnerAnnouncement.type}</h3>

                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 mb-8">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">NÚMEROS DA VITÓRIA</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {winnerAnnouncement.winningNumbers?.map((n: any) => (
                      <div key={n} className="size-8 rounded-full bg-primary text-white font-black flex items-center justify-center text-sm shadow-md">
                        {n}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 mb-10">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">VALOR DO PRÊMIO</p>
                  <p className="text-green-500 font-black text-4xl tabular-nums">B$ {winnerAnnouncement.value}</p>
                </div>
              </>
            ) : (
              // LOSER VIEW
              <>
                <p className="text-white/30 font-black text-[10px] uppercase tracking-[0.4em] mb-6">NÃO DEU PRA VOCÊ...</p>
                <div className="size-32 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-8 grayscale opacity-50">
                  <span className="material-symbols-outlined text-6xl text-white">sentiment_dissatisfied</span>
                </div>
                <h3 className="text-2xl font-black italic text-white/60 mb-8 leading-tight uppercase">MAIS SORTE NA PRÓXIMA!</h3>
                <p className="text-xs text-white/40 mb-10 px-8">Bora para a cartela cheia ou para a próxima rodada!</p>
              </>
            )}

            {isHost ? (
              winnerAnnouncement.type !== 'Cartela Cheia' ? (
                <button onClick={togglePause} className="w-full h-20 bg-primary text-white font-black rounded-3xl text-xl shadow-xl shadow-primary/20 active:scale-95 transition-all">CONTINUAR JOGO</button>
              ) : (
                roundNumber < totalRounds ? (
                  <button onClick={handleNextRound} className="w-full h-20 bg-primary text-white font-black rounded-3xl text-xl shadow-xl shadow-primary/20 active:scale-95 transition-all">PRÓXIMA RODADA</button>
                ) : (
                  <button onClick={handleFinish} className="w-full h-20 bg-red-500 text-white font-black rounded-3xl text-xl shadow-xl shadow-red-500/20 active:scale-95 transition-all">FINALIZAR MESA</button>
                )
              )
            ) : (
              <button
                onClick={() => setWinnerAnnouncement(null)}
                className="w-full h-20 bg-white/5 text-white/30 font-black rounded-3xl uppercase tracking-widest active:scale-95 transition-all"
              >
                FECHAR
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};