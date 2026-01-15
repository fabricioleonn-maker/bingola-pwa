import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomSession } from '../state/useRoomSession';
import { useRoomStore } from '../state/roomStore';

interface Props {
  roomInfo: any;
  onBack: () => void;
  onWin: () => void;
  onNavigate?: (screen: any) => void;
}

export const GameScreen: React.FC<Props> = ({ roomInfo: propRoomInfo, onBack, onWin, onNavigate }) => {
  useRoomSession(propRoomInfo?.id);
  const room = useRoomStore(s => s.room);
  const hardExit = useRoomStore(s => s.hardExit);

  const [grid, setGrid] = useState<number[][]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [custom, setCustom] = useState<any>({ cardColor: '#ff3d71', stampIcon: 'stars', opacity: 80, selectedTheme: 'retro' });
  const [timeLeft, setTimeLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [gameRules, setGameRules] = useState<any>({ cheia: true, cinquina: true, cantos: true, x: true });
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<any>(null);
  const [claimedPrizes, setClaimedPrizes] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const getBingoLabel = (num: number): string => {
    if (num <= 0) return "";
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const generateGrid = () => {
    const shuffle = (arr: number[]) => [...arr].sort(() => Math.random() - 0.5);
    const cols = [
      shuffle(Array.from({ length: 15 }, (_, i) => i + 1)).slice(0, 5),
      shuffle(Array.from({ length: 15 }, (_, i) => i + 16)).slice(0, 5),
      shuffle(Array.from({ length: 15 }, (_, i) => i + 31)).slice(0, 5),
      shuffle(Array.from({ length: 15 }, (_, i) => i + 46)).slice(0, 5),
      shuffle(Array.from({ length: 15 }, (_, i) => i + 61)).slice(0, 5),
    ];
    cols[2][2] = 0; // FREE
    const result = [];
    for (let r = 0; r < 5; r++) {
      result.push([cols[0][r], cols[1][r], cols[2][r], cols[3][r], cols[4][r]]);
    }
    return result;
  };

  const isPaused = localStorage.getItem('bingola_is_paused') === 'true';
  const drawnNumbers = room?.drawn_numbers || [];
  const roomInfo = room || propRoomInfo;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const hostId = (roomInfo as any)?.host_id ?? (roomInfo as any)?.hostId;
  const isHost = !!currentUserId && !!hostId && currentUserId === hostId;


  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    if (settings.rules) setGameRules(settings.rules);

    const savedGrid = localStorage.getItem('bingola_player_grid');
    if (savedGrid) {
      setGrid(JSON.parse(savedGrid));
    } else {
      const newGrid = generateGrid();
      setGrid(newGrid);
      localStorage.setItem('bingola_player_grid', JSON.stringify(newGrid));
    }

    setMarked(JSON.parse(localStorage.getItem('bingola_player_marked') || '[]'));
    setClaimedPrizes(JSON.parse(localStorage.getItem('bingola_claimed_prizes') || '[]'));

    const savedCustom = localStorage.getItem('bingola_card_custom');
    if (savedCustom) setCustom(JSON.parse(savedCustom));
  }, []);

  useEffect(() => {
    if (room?.status === 'finished') {
      alert("O anfitrião encerrou a mesa.");
      onBack();
    }
  }, [room?.status]);

  // Handle Join Requests for Host
  useEffect(() => {
    if (!isHost || !roomInfo?.id) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomInfo.id)
        .eq('status', 'pending');
      if (data) setPendingRequests(data.map(p => ({
        id: p.user_id,
        participant_id: p.id,
        name: p.profiles?.username || 'Jogador',
        avatar: p.profiles?.avatar_url
      })));
    };

    fetchRequests();

    const channel = supabase.channel(`game_requests:${roomInfo.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomInfo.id}` }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isHost, roomInfo?.id]);

  // Sync time left local logic (simple timer based on last draw time in local storage)
  useEffect(() => {
    const handleSync = () => {
      const lastTime = Number(localStorage.getItem('bingola_last_draw_time') || Date.now());
      const settings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
      const interval = settings.interval || 12;
      const elapsed = Math.floor((Date.now() - lastTime) / 1000);
      setTimeLeft(Math.max(0, interval - elapsed));
    };
    const interval = setInterval(handleSync, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthorize = async (player: any, allow: boolean) => {
    if (allow) await supabase.from('participants').update({ status: 'accepted' }).eq('id', player.participant_id);
    else await supabase.from('participants').update({ status: 'rejected' }).eq('id', player.participant_id);
  };

  const handleBingo = () => {
    const isMarked = (n: number) => n === 0 || marked.includes(n);
    let winType = null;
    let isFullCard = false;

    const onlyCheiaActive = !gameRules.cinquina && !gameRules.cantos && !gameRules.x;
    const hasAnySecondaryWon = claimedPrizes.some(p => p.type !== 'Cartela Cheia');

    if (gameRules.cheia && grid.flat().every(isMarked)) {
      winType = "Cartela Cheia";
      isFullCard = true;
    } else if (!hasAnySecondaryWon && !onlyCheiaActive) {
      if (gameRules.cinquina) {
        for (let r = 0; r < 5; r++) if (grid[r].every(isMarked)) winType = "Cinquina";
        for (let c = 0; c < 5; c++) {
          let col = true;
          for (let r = 0; r < 5; r++) if (!isMarked(grid[r][c])) col = false;
          if (col) winType = "Cinquina";
        }
      }
      if (!winType && gameRules.cantos) {
        if ([grid[0][0], grid[0][4], grid[4][0], grid[4][4]].every(isMarked)) winType = "Cantos";
      }
      if (!winType && gameRules.x) {
        const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
        const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
        if (d1.every(isMarked) && d2.every(isMarked)) winType = "Cartela em X";
      }
    }

    if (winType) {
      const user = JSON.parse(localStorage.getItem('bingola_current_user') || '{}');
      let prizeValue = 0;
      if (onlyCheiaActive) {
        prizeValue = roomInfo.bpoints;
      } else {
        prizeValue = isFullCard ? Math.floor(roomInfo.bpoints * 0.7) : Math.floor(roomInfo.bpoints * 0.3);
      }

      const newPrize = { winner: user.name || user.email?.split('@')[0], type: winType, value: prizeValue };
      const updatedPrizes = [...claimedPrizes, newPrize];
      localStorage.setItem('bingola_claimed_prizes', JSON.stringify(updatedPrizes));
      setClaimedPrizes(updatedPrizes);

      localStorage.setItem('bingola_last_winner', JSON.stringify(newPrize));
      setWinnerAnnouncement(newPrize);

      if (isFullCard) {
        // Stop current round drawing
        localStorage.setItem('bingola_game_running', 'false');
        localStorage.setItem('bingola_is_paused', 'true');

        if (roomInfo.current_round >= roomInfo.rounds) {
          // Last round: table will be finished after inspection
          // We don't call handleFinish(true) automatically anymore to let users see the final results
        } else {
          // Not last round - we stay in the game screen
        }
      } else {
        localStorage.setItem('bingola_is_paused', 'true');
      }
    } else {
      setErrorMsg("VOCÊ AINDA NÃO GANHOU ESPERTINHO! CONTINUE MARCANDO");
      setTimeout(() => setErrorMsg(null), 3500);
    }
  };

  const handleNextRound = () => {
    if (!isHost) return;

    const nextRound = (roomInfo.current_round || 0) + 1;
    if (nextRound > (roomInfo.rounds || 0)) return;

    // Reset game state for next round
    localStorage.setItem('bingola_game_running', 'false');
    localStorage.setItem('bingola_is_paused', 'false');
    localStorage.removeItem('bingola_player_marked');
    localStorage.removeItem('bingola_player_grid');
    localStorage.removeItem('bingola_claimed_prizes');
    localStorage.removeItem('bingola_last_winner');

    // Local cleanup:
    setMarked([]);
    setClaimedPrizes([]);
    setWinnerAnnouncement(null);

    // Generate new grid for the new round
    const newGrid = generateGrid();
    setGrid(newGrid);
    localStorage.setItem('bingola_player_grid', JSON.stringify(newGrid));

    window.dispatchEvent(new CustomEvent('bingola_refresh_state'));
  };

  const handleFinish = async (silent = false) => {
    if (!silent && !window.confirm("Tem certeza que deseja encerrar a mesa?")) return;

    // Update remote status to finished
    if (roomInfo?.id) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomInfo.id);
    }

    localStorage.removeItem('bingola_game_running');
    localStorage.removeItem('bingola_active_room');
    if (onBack) onBack();
  };

  const togglePause = () => {
    const newVal = !isPaused;
    localStorage.setItem('bingola_is_paused', String(newVal));
    if (!newVal) localStorage.removeItem('bingola_last_winner');
  };

  const markNumber = (num: number) => {
    // Cannot mark if not drawn (unless free space 0)
    if (num !== 0 && !drawnNumbers.includes(num)) return;

    let newMarked;
    if (marked.includes(num)) {
      newMarked = marked.filter(n => n !== num);
    } else {
      newMarked = [...marked, num];
    }
    setMarked(newMarked);
    localStorage.setItem('bingola_player_marked', JSON.stringify(newMarked));
  };

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
        <button onClick={() => onBack()} className="size-10 flex items-center"><span className="material-symbols-outlined">chevron_left</span></button>
        <div className="text-center flex-1">
          <h2 className="text-[10px] font-black opacity-30 uppercase tracking-widest">{roomInfo?.name || 'Mesa Ativa'}</h2>
          <p className="text-xs font-black text-primary italic leading-none">RODADA {roomInfo?.current_round || 1}/{roomInfo?.rounds || 1}</p>
        </div>
        <div className="flex items-center gap-1">
          {isHost && (
            <div className="relative">
              <button onClick={() => setShowAuthModal(true)} title="Novos Jogadores" className="size-10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">person_add</span>
                {pendingRequests.length > 0 && (
                  <div className="absolute top-1 right-1 size-2 bg-red-500 rounded-full animate-ping"></div>
                )}
              </button>
            </div>
          )}
          <button onClick={() => setShowRulesInfo(true)} className="size-10 flex items-center justify-center text-white/30 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">info</span>
          </button>

          {isHost && (
            <button onClick={() => handleFinish()} className="size-10 flex items-center justify-center text-red-500/80"><span className="material-symbols-outlined">power_settings_new</span></button>
          )}

          {isHost && (
            <button onClick={togglePause} className="size-10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">{isPaused ? 'play_arrow' : 'pause'}</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center space-y-6 overflow-y-auto pb-40">
        <div className="text-center flex flex-col items-center w-full">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 uppercase">
            {isPaused ? 'SORTEIO PAUSADO' : `PRÓXIMO EM ${timeLeft}S`}
          </p>
          <div className="size-64 bg-white rounded-full flex flex-col items-center justify-center shadow-[0_0_120px_rgba(255,61,113,0.3)] border-[12px] border-primary relative">
            {lastNum && (
              <span className="text-primary font-black text-2xl absolute top-8 animate-pulse leading-none">{getBingoLabel(lastNum)}</span>
            )}
            <span className="text-zinc-900 text-[120px] font-black leading-none tabular-nums mt-4 block">
              {lastNum || '--'}
            </span>
          </div>
        </div>

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

        <div className={`w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border-8 ${theme.cardBg} ${theme.border} flex flex-col`}>
          <div className="h-14 flex items-center justify-around bg-primary" style={{ backgroundColor: custom.cardColor }}>
            {['B', 'I', 'N', 'G', 'O'].map(l => <span key={l} className="text-white font-black text-2xl">{l}</span>)}
          </div>
          <div className="grid grid-cols-5 gap-2 p-3 bg-black/5">
            {grid.length > 0 && grid.flat().map((num, i) => (
              <button key={i} onClick={() => markNumber(num)} className={`aspect-square flex flex-col items-center justify-center rounded-2xl relative border-2 transition-all ${num === 0 ? 'bg-primary/10 border-primary/20' : (marked.includes(num) ? 'bg-white/5 border-white/10 shadow-inner' : `${theme.cellBg} ${theme.border} ${theme.textColor}`)}`}>
                {num === 0 ? (
                  <div className="flex flex-col items-center leading-none text-primary font-black">
                    <span className="text-[6px]">BINGOLA</span>
                    <span className="text-[7px]">LIVRE</span>
                  </div>
                ) : (
                  <span className={`text-xl font-black ${marked.includes(num) ? 'opacity-20' : ''}`}>{num}</span>
                )}
                {marked.includes(num) && num !== 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: custom.opacity / 100 }}>
                    <span className="material-symbols-outlined text-4xl" style={{ color: custom.cardColor }}>{custom.stampIcon}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleBingo} className="w-full h-24 bg-primary text-white font-black text-5xl rounded-[3rem] shadow-2xl active:scale-95 transition-all italic tracking-tighter shadow-primary/30">BINGO!</button>

        {errorMsg && (
          <div className="fixed inset-x-0 bottom-40 flex justify-center z-[100] pointer-events-none px-6">
            <div className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm uppercase text-center shadow-2xl border-4 border-white animate-bounce">
              {errorMsg}
            </div>
          </div>
        )}
      </main>

      {showRulesInfo && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowRulesInfo(false)}>
          <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowRulesInfo(false)} className="absolute top-6 right-6 text-white/40"><span className="material-symbols-outlined">close</span></button>
            <div className="text-center mb-6">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">CÓDIGO DA SALA</p>
              <h3 className="text-4xl font-black italic text-white tracking-widest">{roomInfo?.code || '----'}</h3>
            </div>
            <h3 className="text-xl font-black text-white italic mb-4 border-t border-white/5 pt-4">Regras da Mesa</h3>
            <div className="space-y-3">
              {Object.entries(gameRules).filter(([_, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl capitalize">
                  <span className="material-symbols-outlined text-primary">verified</span>
                  <p className="font-bold text-sm text-white">{k === 'cheia' ? 'Cartela Cheia' : k === 'x' ? 'Cartela em X' : k}</p>
                </div>
              ))}
              <div className="flex items-center gap-4 bg-green-500/10 p-4 rounded-2xl">
                <span className="material-symbols-outlined text-green-500">payments</span>
                <p className="font-bold text-sm text-green-500">{roomInfo?.bpoints} BPOINTS EM JOGO</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black text-center mb-6 italic text-primary uppercase tracking-widest">Autorizar Jogador</h3>
            <div className="space-y-4 mb-8">
              {pendingRequests.length === 0 ? (
                <p className="text-center text-white/30 text-xs italic">Nenhum pedido pendente no momento.</p>
              ) : pendingRequests.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <img src={p.avatar} className="size-10 rounded-full border border-primary/20" />
                    <span className="font-bold text-sm">{p.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAuthorize(p, false)} className="size-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                    <button onClick={() => handleAuthorize(p, true)} className="size-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">check</span></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAuthModal(false)} className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl">FECHAR</button>
          </div>
        </div>
      )}

      {winnerAnnouncement && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-surface-dark w-full max-w-sm p-8 rounded-[3rem] border-4 border-primary shadow-[0_0_100px_rgba(255,61,113,0.4)] text-center relative animate-in zoom-in-95 duration-300">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 size-24 bg-primary rounded-3xl flex items-center justify-center shadow-2xl rotate-12">
              <span className="material-symbols-outlined text-white text-5xl fill-1">workspace_premium</span>
            </div>

            <div className="mt-8 mb-6">
              <p className="text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">Ganhador da Rodada</p>
              <h3 className="text-4xl font-black italic text-white leading-tight">{winnerAnnouncement.winner}</h3>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/5 mb-8">
              <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">{winnerAnnouncement.type}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-green-500">payments</span>
                <span className="text-3xl font-black text-green-500">{winnerAnnouncement.value} BPOINTS</span>
              </div>
            </div>

            {isHost ? (
              <div className="space-y-3">
                {/* Secondary Prize -> Allow continue */}
                {winnerAnnouncement.type !== 'Cartela Cheia' ? (
                  <button
                    onClick={() => {
                      localStorage.removeItem('bingola_last_winner');
                      setWinnerAnnouncement(null);
                      localStorage.setItem('bingola_is_paused', 'false');
                    }}
                    className="w-full h-16 bg-white text-background-dark font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    CONTINUAR JOGO
                  </button>
                ) : (
                  // Full Card -> End Round or Table
                  roomInfo.current_round < roomInfo.rounds ? (
                    <>
                      <p className="text-[10px] font-bold text-white/40 mb-2 uppercase">Próxima rodada disponível ({roomInfo.current_round + 1}/{roomInfo.rounds})</p>
                      <button onClick={handleNextRound} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all">INICIAR PRÓXIMA RODADA</button>
                    </>
                  ) : (
                    <button onClick={() => handleFinish()} className="w-full h-16 bg-red-500 text-white font-black rounded-2xl active:scale-95 transition-all">ENCERRAR MESA</button>
                  )
                )}
                {/* Close view button always available */}
                <button
                  onClick={() => setWinnerAnnouncement(null)}
                  className="w-full h-12 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                >
                  Fechar Visualização
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium text-white/60 italic">Aguardando o anfitrião iniciar a próxima rodada...</p>
                <button onClick={() => setWinnerAnnouncement(null)} className="w-full h-12 bg-white/5 text-white/40 font-black rounded-2xl text-[10px] uppercase tracking-widest">FECHAR</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
