
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';
import { useNotificationStore } from '../state/notificationStore';
import { AppScreen } from '../types';
import { useAudioStore } from '../state/audioStore';
import { speakBingoNumber } from '../lib/speechService';
import { useTutorialStore } from '../state/tutorialStore';
import { setNoResume, clearBingolaLocalState } from '../state/persist';
import { useChatStore } from '../state/chatStore';
import { useFriendshipStore } from '../state/friendshipStore';
import { FloatingChat } from '../components/FloatingChat';
import { triggerWinCelebration, triggerLoseSound } from '../lib/celebrationService';

interface Props {
  roomInfo: any;
  onBack: () => void;
  onWin: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const GameScreen: React.FC<Props> = ({ roomInfo: propRoomInfo, onBack, onWin, onNavigate }) => {
  const room = useRoomStore(s => s.room);
  const roomId = useRoomStore(s => s.roomId);
  const acceptedList = useRoomStore(s => s.accepted);
  const myStatus = useRoomStore(s => s.myStatus);
  const realtimeStatus = useRoomStore(s => s.realtime);

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

  const [isMaster, setIsMaster] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRoomClosed, setShowRoomClosed] = useState(false);
  const [newInterval, setNewInterval] = useState(12);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const { selectedVoice, setVoice, isNarrationMuted, toggleNarration } = useAudioStore();

  const winnerChannelRef = useRef<any>(null);
  const finishedAlertedRef = useRef(false);

  // Security Guard Retry State
  const [securityRetries, setSecurityRetries] = useState(0);
  const securityWaitRef = useRef(false);

  // Ensure we are subscribed to the room
  useEffect(() => {
    if (roomId) {
      const unsub = useRoomStore.getState().subscribe(roomId);
      return () => unsub();
    }
  }, [roomId]);
  const handleLeavePermanent = async () => {
    if (currentUserId && roomId) {
      try {
        if (isHost) {
          await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
        }
        await useRoomStore.getState().hardExit(roomId, currentUserId);
        onBack();
      } catch (err) {
        console.error("Error leaving room:", err);
        onBack();
      }
    }
  };

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
        if (user.email === 'fabricio.leonn@gmail.com') setIsMaster(true);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setCurrentUserProfile(profile);
      }
    });

    if (roomInfo?.draw_interval) setNewInterval(roomInfo.draw_interval);

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

  // Render Check: Logic only
  const dataReady = acceptedList.length > 0 || realtimeStatus === 'SUBSCRIBED';
  const amIAccepted = acceptedList.some(p => p.user_id === currentUserId && p.status === 'accepted');
  const showLoader = !isHost && (!!roomId) && (!currentUserId || !dataReady || !amIAccepted);

  // Diagnostic Log for Master/Host Access
  useEffect(() => {
    if (currentUserId || roomId) {
      console.log("[Game] Status:", {
        userId: currentUserId,
        hostId,
        isHost,
        roomId,
        roomStatus: roomInfo?.status,
        loaderActive: showLoader
      });
    }
  }, [currentUserId, hostId, isHost, roomId, roomInfo?.status, showLoader]);

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

    // Auto-pause music on game entry (User preference for silence during raffle)
    // But allow manual resume via settings since we removed the lock in BackgroundMusic
    if (useAudioStore.getState().isPlaying) {
      useAudioStore.getState().togglePlay();
    }

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
      localStorage.removeItem('bingola_last_winner');
      localStorage.setItem('bingola_is_paused', 'false');

      if (!isHost) {
        setShowRoomClosed(true);
      } else {
        setWinnerAnnouncement(null);
        onBack();
      }
    }
  }, [room?.status, onBack]);

  // SECURITY GUARD: FORCE REDIRECT if user is not accepted and not host
  useEffect(() => {
    if (!isHost && roomId && currentUserId) {
      const dataReady = realtimeStatus === 'SUBSCRIBED';

      if (dataReady) {
        if (myStatus === 'accepted') {
          if (securityRetries > 0) setSecurityRetries(0);
          securityWaitRef.current = false;
          return;
        }

        if (myStatus === 'rejected') {
          console.log("Security Guard: User rejected via Store. Redirecting...");
          onNavigate('participant_lobby');
          return;
        }

        if (securityWaitRef.current) return;

        // Perform aggressive check
        (async () => {
          securityWaitRef.current = true;

          // Direct DB check to see REAL status (ignoring Store lag)
          console.log("Security Guard: Checking DB for status...", { roomId, currentUserId });
          const { data: part } = await supabase.from('participants')
            .select('status')
            .eq('room_id', roomId)
            .eq('user_id', currentUserId)
            .maybeSingle();

          console.log("Security Guard: DB result:", part);

          if (part?.status === 'rejected') {
            // Explicit Rejection - Navigate to Lobby to show Rejection Screen
            console.log("Security Guard: User rejected. Redirecting to lobby for rejection screen.");
            onNavigate('participant_lobby');
            return;
          }

          if (part?.status === 'pending') {
            console.log("Security Guard: User pending. Redirecting to lobby.");
            onNavigate('participant_lobby');
            return;
          }

          // If DB says accepted (or missing record?), try to sync Store
          if (securityRetries < 3) {
            console.log(`Security Guard: User missing but not rejected in DB. Refreshing Store... (${securityRetries + 1}/3)`);
            useRoomStore.getState().refreshParticipants(roomId);
            setTimeout(() => {
              setSecurityRetries(prev => prev + 1);
              securityWaitRef.current = false;
            }, 2000);
          } else {
            console.error("Security Guard: User unauthorized after retries. Redirecting.");
            onNavigate('participant_lobby');
          }
        })();
      }
    }
  }, [isHost, roomId, acceptedList, currentUserId, onNavigate, realtimeStatus, securityRetries]);

  // Listen for MY status changes (Immediate Rejection)
  useEffect(() => {
    if (isHost || !currentUserId || !roomId) return;

    // Realtime Listener
    const channel = supabase.channel(`game_security_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events (DELETE, UPDATE etc)
          schema: 'public',
          table: 'participants',
          filter: `user_id=eq.${currentUserId}`
        },
        (payload: any) => {
          // Verify it's for THIS room
          if (payload.new && payload.new.room_id !== roomId) return;
          if (payload.old && payload.old.room_id !== roomId && !payload.new) return;

          console.log("Game Security: Realtime Event:", payload);
          if (payload.eventType === 'DELETE' || (payload.new && payload.new.status === 'rejected')) {
            console.log("Game Security: Rejected/Removed via Realtime. Redirecting...");
            useRoomStore.getState().refreshParticipants(roomId); // Force store update
            onNavigate('participant_lobby');
          }
        }
      )
      .subscribe();

    // Polling Fallback (every 3s)
    const interval = setInterval(async () => {
      const { data: part } = await supabase.from('participants')
        .select('status')
        .eq('room_id', roomId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!part || part.status === 'rejected') {
        console.log("Game Security: Rejected via Polling. Redirecting...");
        onNavigate('participant_lobby');
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentUserId, roomId, onNavigate]);

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
        console.log('[Winner Broadcast] Received:', payload.payload);
        console.log('[Winner Broadcast] Current User ID:', currentUserId);

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

        // CELEBRATION: Trigger win/lose effects
        setTimeout(() => {
          if (!currentUserId) {
            console.warn('[Celebration] SKIPPED: currentUserId is null!');
            return;
          }

          if (payload.payload.winner_id === currentUserId) {
            console.log('[Celebration] YOU WON! Triggering confetti...');
            triggerWinCelebration();
          } else {
            console.log('[Celebration] Someone else won. Playing lose sound...');
            triggerLoseSound();
          }
        }, 300);
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

  const { playSfx } = useAudioStore();
  const lastAudioNumRef = useRef<number | null>(null);
  const isDrumPlayingRef = useRef(false);

  // Raffling Audio Logic
  useEffect(() => {
    if (drawnNumbers.length === 0 || isPaused) return;

    const lastDrawTimeStr = roomInfo?.updated_at || localStorage.getItem('bingola_last_draw_time');
    const lastDraw = lastDrawTimeStr ? new Date(lastDrawTimeStr).getTime() : Date.now();
    const now = Date.now();
    const currentNum = drawnNumbers[drawnNumbers.length - 1];

    if (lastAudioNumRef.current !== currentNum) {
      lastAudioNumRef.current = currentNum;
      // REMOVED: playSfx('drop') - User requested no sound during draws
      speakBingoNumber(currentNum, isNarrationMuted, selectedVoice);
    }
  }, [drawnNumbers.length, isPaused, isNarrationMuted, selectedVoice]);

  // Sync timer with Server Timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused || (winnerAnnouncement && !isHost)) return;

      // Use server timestamp (updated_at) if available, fallback to local last draw
      // This ensures everyone counts down from the same "Server Time"
      const lastDrawTimeStr = roomInfo?.updated_at || localStorage.getItem('bingola_last_draw_time');
      const lastDraw = lastDrawTimeStr ? new Date(lastDrawTimeStr).getTime() : Date.now();

      const drawDelay = (roomInfo as any)?.draw_interval || 12;
      const elapsed = Math.floor((Date.now() - lastDraw) / 1000);
      const remaining = Math.max(0, drawDelay - elapsed);

      setTimeLeft(remaining);
    }, 100); // 100ms poll for smooth seconds
    return () => clearInterval(interval);
  }, [isPaused, roomInfo?.draw_interval, roomInfo?.updated_at, winnerAnnouncement]);

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

    // 1. Always calculate potential win independently of current claims
    if (grid.flat().every(isMarked)) {
      winType = "Cartela Cheia";
      isFullCard = true;
    } else {
      // Check secondary patterns strictly
      if (patterns.cinquina) {
        // Horizontal
        for (let r = 0; r < 5; r++) if (grid[r].every(isMarked)) winType = "Cinquina";

        // Vertical
        if (!winType) {
          for (let c = 0; c < 5; c++) {
            let colWin = true;
            for (let r = 0; r < 5; r++) if (!isMarked(grid[r][c])) colWin = false;
            if (colWin) winType = "Cinquina";
          }
        }

        // Diagonals
        if (!winType) {
          const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
          const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
          if (d1.every(isMarked) || d2.every(isMarked)) winType = "Cinquina";
        }
      }

      // Check Cantos
      if (!winType && patterns.cantos) {
        const corners = [grid[0][0], grid[0][4], grid[4][0], grid[4][4]];
        if (corners.every(isMarked)) winType = "Cantos";
      }

      // Check Cartela em X
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

    // 2. Validate against Rules
    const secondaryAlreadyClaimed = claimedPrizes.some(p => p.type !== 'Cartela Cheia');

    // Rule: Absolute Exclusivity for Secondary Prizes
    if (winType !== 'Cartela Cheia' && secondaryAlreadyClaimed) {
      setErrorMsg("PRÊMIO SECUNDÁRIO JÁ SAIU! AGORA SÓ VALE CARTELA CHEIA.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    // Check if user already claimed THIS specific prize
    if (claimedPrizes.some(p => p.winner_id === currentUserId && p.type === winType)) {
      useNotificationStore.getState().show("Você já reivindicou este prêmio!", 'info');
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
      // Horizontal
      for (let r = 0; r < 5; r++) {
        if (grid[r].every(isMarked)) winningNumbers = grid[r].filter(n => n !== 0);
      }
      // Vertical (if not already set)
      if (winningNumbers.length === 0) {
        for (let c = 0; c < 5; c++) {
          let column = [grid[0][c], grid[1][c], grid[2][c], grid[3][c], grid[4][c]];
          if (column.every(isMarked)) winningNumbers = column.filter(n => n !== 0);
        }
      }
      // Diagonals (if not already set)
      if (winningNumbers.length === 0) {
        const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
        const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
        if (d1.every(isMarked)) winningNumbers = d1.filter(n => n !== 0);
        else if (d2.every(isMarked)) winningNumbers = d2.filter(n => n !== 0);
      }
    }
    else if (winType === 'Cantos') {
      const corners = [grid[0][0], grid[0][4], grid[4][0], grid[4][4]];
      winningNumbers = corners.filter(n => n !== 0);
    } else if (winType === 'Cartela em X') {
      const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
      const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
      // unique numbers
      winningNumbers = [...new Set([...d1, ...d2])].filter(n => n !== 0);
    }

    const winnerName = currentUserProfile?.username || currentUserProfile?.name || 'Jogador';
    const winData = {
      winner: winnerName,
      winner_id: currentUserId,
      type: winType,
      value: prizeValue,
      pot,
      round: roundNumber,
      winningNumbers,
      ts: Date.now()
    };

    // Optimistically update local state to prevent double-claiming and update UI instantly
    setClaimedPrizes(prev => {
      // Safety check just in case
      if (prev.some(p => p.type === winType && p.winner_id === currentUserId)) return prev;
      const newList = [...prev, winData];
      localStorage.setItem(claimedKey, JSON.stringify(newList));
      return newList;
    });

    // REWARD: Automatically award BPoints for ranking
    const bpointsReward = isFullCard ? 35 : 10;
    if (currentUserId) {
      supabase.from('profiles').select('bpoints').eq('id', currentUserId).single()
        .then(({ data }) => {
          if (data) {
            supabase.from('profiles').update({ bpoints: (data.bpoints || 0) + bpointsReward }).eq('id', currentUserId)
              .then(() => console.log(`[Ranking] Reward +${bpointsReward} BPoints applied.`));
          }
        });
    }

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

    // CELEBRATION: Trigger for the winner (YOU!)
    setTimeout(() => {
      console.log('[Celebration] LOCAL WIN! Triggering confetti...');
      triggerWinCelebration();
    }, 300);
  };

  const togglePause = () => {
    const newVal = !isPaused;

    // If resuming, clear winner announcement and broadcast to everyone
    if (!newVal) {
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
    if (!newVal) {
      localStorage.removeItem('bingola_last_winner');
    }
  };

  const [showEndGameModal, setShowEndGameModal] = useState(false);

  const handleFinish = () => {
    setShowEndGameModal(true);
  };

  const confirmEndGame = async () => {
    // 1. Mark status as finished in DB
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);

    // 2. Clear local limits and state
    setNoResume();
    clearBingolaLocalState();
    useRoomStore.getState().setRoomId(null);

    // 3. Navigate back
    onBack();
  };

  const handleNextRound = async () => {
    // Determine next round number
    const next = (roomInfo.current_round || 1) + 1;

    // Optimistic Update: clear numbers and set playing
    useRoomStore.getState().updateRoomStatus('playing');
    // We might need a way to clear drawn_numbers in store too, but status is key.

    // Reset local controls
    localStorage.removeItem('bingola_last_winner');
    // 1. Start Paused (Wait for Play)
    localStorage.setItem('bingola_is_paused', 'true');
    setIsPaused(true);

    // Force immediate draw for the new round
    localStorage.setItem('bingola_last_draw_time', (Date.now() - 60000).toString());

    // DB Update
    await supabase.from('rooms').update({
      current_round: next,
      status: 'playing', // Status is playing, but logic loop will respect isPaused
      drawn_numbers: []
    }).eq('id', roomId);

    setWinnerAnnouncement(null);
  };

  // Track if we are in the process of authorizing to auto-close modal
  const authorizingRef = useRef(false);

  useEffect(() => {
    if (authorizingRef.current && pendingRequests.length === 0) {
      setShowAuthModal(false);
      authorizingRef.current = false;
    }
  }, [pendingRequests]);

  const handleAuthorize = async (pId: string, allow: boolean) => {
    authorizingRef.current = true;
    const request = pendingRequests.find(p => String(p.participant_id) === String(pId));

    // Optimistic update
    const newPending = pendingRequests.filter(p => String(p.participant_id) !== String(pId));
    setPendingRequests(newPending);

    if (allow) {
      // Player Limit Check
      const limit = roomInfo?.player_limit || 20;
      if (acceptedList.length >= limit) {
        useNotificationStore.getState().show("Limite de jogadores atingido nesta mesa!", 'error');
        // Restore to pending list
        setPendingRequests(prev => [...prev, request]);
        authorizingRef.current = false;
        return;
      }

      useNotificationStore.getState().show("Jogador aceito!", 'success');
      await supabase.from('participants').update({ status: 'accepted' }).eq('id', pId);
    } else {
      if (request && roomId) {
        // Track ban count (2 rejections = ban)
        const userId = request.id;
        const { data: existing } = await supabase.from('room_bans').select('rejection_count').eq('room_id', roomId).eq('user_id', userId).maybeSingle();

        if (existing) {
          await supabase.from('room_bans').update({ rejection_count: existing.rejection_count + 1 }).eq('room_id', roomId).eq('user_id', userId);
        } else {
          await supabase.from('room_bans').insert({ room_id: roomId, user_id: userId, rejection_count: 1 });
        }
      }
      await supabase.from('participants').update({ status: 'rejected' }).eq('id', pId);
    }
  };

  const getBingoLabel = (n: number) => {
    if (n <= 15) return 'B';
    if (n <= 30) return 'I';
    if (n <= 45) return 'N';
    if (n <= 60) return 'G';
    return 'O';
  };

  const saveRhythm = async () => {
    if (!roomId || !isHost) return;
    try {
      await supabase.from('rooms').update({ draw_interval: newInterval }).eq('id', roomId);
      useNotificationStore.getState().show("Ritmo atualizado!", 'success');
      setShowRulesInfo(false);
    } catch (e) {
      console.error(e);
      useNotificationStore.getState().show("Erro ao salvar ritmo", 'error');
    }
  };

  // State for card customization
  const [cardCustom, setCardCustom] = useState<any>({
    selectedTheme: 'classic',
    cardColor: '#FF3D71',
    stampIcon: 'stars',
    opacity: 100
  });

  // Load customizations on mount/focus
  useEffect(() => {
    const loadCustom = () => {
      const saved = localStorage.getItem('bingola_card_custom');
      if (saved) {
        setCardCustom(JSON.parse(saved));
      }
    };
    loadCustom();
    window.addEventListener('focus', loadCustom);
    return () => window.removeEventListener('focus', loadCustom);
  }, []);

  const theme = {
    retro: { cardBg: 'bg-[#f0e6d2]', cellBg: 'bg-white', textColor: 'text-[#4a3a2a]', border: 'border-[#d6ccb8]' },
    classic: { cardBg: 'bg-gray-50', cellBg: 'bg-white', textColor: 'text-zinc-800', border: 'border-gray-200' },
    neon: { cardBg: 'bg-[#0a0a0a]', cellBg: 'bg-[#1a1a1a]', textColor: 'text-white/90', border: 'border-primary/20' },
    minimal: { cardBg: 'bg-white shadow-2xl', cellBg: 'bg-transparent', textColor: 'text-zinc-900', border: 'border-transparent' }
  }[cardCustom.selectedTheme as string] || { cardBg: 'bg-surface-dark', cellBg: 'bg-white/5', textColor: 'text-white', border: 'border-white/10' };

  const lastNum = drawnNumbers[drawnNumbers.length - 1] || null;


  useEffect(() => {
    // If we already loaded this exact key, do nothing unless grid is empty
    if (loadedGridKeyRef.current === gridKey && grid.length > 0) return;

    // Auto-pause music on game entry
    if (useAudioStore.getState().isPlaying) {
      useAudioStore.getState().togglePlay();
    }

    // CRITICAL FIX: Force refresh participants on mount to ensure local store is in sync
    // This prevents 'showLoader' from sticking to true if the store is empty
    if (roomId) {
      useRoomStore.getState().refreshParticipants(roomId);
    }

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
  }, [gridKey, markedKey, claimedKey, generateGrid, isHost]);

  if (showLoader) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-dark text-white/50 space-y-4 px-6 text-center">
        <div className="relative">
          <div className="size-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary/30 animate-pulse">check_circle</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="font-display font-black italic text-lg uppercase tracking-widest text-white/80">Sincronizando Mesa...</p>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40">Verificando sua participação no Bingo</p>
        </div>
        <button
          onClick={() => {
            useNotificationStore.getState().confirm({
              title: "Recarregar?",
              message: "Deseja forçar a atualização dos dados? Isso pode resolver problemas de carregamento.",
              onConfirm: () => window.location.reload()
            });
          }}
          className="h-10 px-6 bg-white/5 border border-white/10 rounded-full text-[10px] underline mt-8 opacity-50 hover:opacity-100 uppercase tracking-widest font-black transition-all"
        >
          Demorando muito? Clique aqui
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background-dark text-white font-sans overflow-hidden relative pb-[env(safe-area-inset-bottom)]">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      {showRoomClosed && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in zoom-in duration-300">
          <div className="bg-surface-dark border border-white/10 p-10 rounded-[3rem] w-full max-w-sm text-center shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-600/20 blur-3xl -mt-16"></div>

            <div className="size-24 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/20 animate-pulse">
              <span className="material-symbols-outlined text-white text-5xl">cancel</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Mesa Encerrada!</h2>
              <p className="text-white/40 text-sm leading-relaxed">O anfitrião encerrou esta sessão. Você será redirecionado para a tela inicial.</p>
            </div>

            <button
              onClick={() => {
                useRoomStore.getState().setRoomId(null);
                onBack();
              }}
              className="w-full h-16 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}

      <header className="relative z-10 px-4 pt-4 pb-2 flex flex-col gap-4">
        {/* Horizontal Action Bar - Unified & Scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1 -mx-4 px-5">
          <button onClick={() => setShowExitConfirm(true)} className="size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 active:scale-95 transition-all shadow-sm border border-white/5">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          <button onClick={() => setShowRulesInfo(true)} className="size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 active:scale-95 transition-all shadow-sm border border-white/5">
            <span className="material-symbols-outlined">info</span>
          </button>

          {isMaster && (
            <button
              onClick={async () => {
                if (!roomId) return;
                const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
                await supabase.from('rooms').update({
                  drawn_numbers: allNumbers,
                  updated_at: new Date().toISOString()
                }).eq('id', roomId);
              }}
              className="size-11 shrink-0 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-yellow-500 active:scale-95 transition-all border border-yellow-500/30"
            >
              <span className="material-symbols-outlined">bolt</span>
            </button>
          )}

          <button onClick={() => onNavigate('chat')} className="size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 active:scale-95 transition-all border border-white/5 shadow-sm">
            <span className="material-symbols-outlined text-lg">chat</span>
          </button>

          {/* Voice Controls */}
          <div className="flex shrink-0 items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
            <button
              onClick={toggleNarration}
              className={`size-9 rounded-xl flex items-center justify-center transition-all ${isNarrationMuted ? 'text-white/20' : 'bg-primary/20 text-primary'}`}
            >
              <span className="material-symbols-outlined text-lg">
                {isNarrationMuted ? 'volume_off' : 'record_voice_over'}
              </span>
            </button>
            <button
              onClick={() => setShowVoiceModal(true)}
              className="size-9 rounded-xl flex items-center justify-center text-white/40 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">settings</span>
            </button>
          </div>

          <button
            onClick={() => onNavigate('customization')}
            className="size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">palette</span>
          </button>

          {isHost && (
            <>
              <button
                onClick={togglePause}
                className={`size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center transition-all border border-white/5 shadow-sm ${isPaused ? 'text-green-500 bg-green-500/10' : 'text-white/60'}`}
              >
                <span className="material-symbols-outlined text-lg">{isPaused ? 'play_arrow' : 'pause'}</span>
              </button>

              <button onClick={() => setShowAuthModal(true)} className="size-11 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 active:scale-95 transition-all relative border border-white/5 shadow-sm">
                <span className="material-symbols-outlined text-lg">group</span>
                {pendingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 size-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce border-2 border-background-dark">
                    {pendingRequests.length}
                  </span>
                )}
              </button>

              <button onClick={() => setShowEndGameModal(true)} className="size-11 shrink-0 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 active:scale-95 transition-all border border-red-500/20 shadow-sm">
                <span className="material-symbols-outlined text-lg">power_settings_new</span>
              </button>
            </>
          )}

        </div>

        {/* Improved Room Info Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-1">CÓDIGO DA MESA</span>
            <span className="font-display font-black text-lg text-primary truncate max-w-[200px]">{roomInfo?.code || '---'}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-1">HOST</span>
            <span className="text-xs font-bold text-white/60">{isHost ? 'Você' : (roomInfo as any)?.host_profile?.username || (roomInfo as any)?.host_name || 'Anfitrião'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center space-y-6 overflow-y-auto pb-40">
        <div className="text-center flex flex-col items-center w-full">
          {/* SYNC BUFFER LOGIC */}
          {(() => {
            const lastDrawTimeStr = roomInfo?.updated_at || localStorage.getItem('bingola_last_draw_time');
            const lastDraw = lastDrawTimeStr ? new Date(lastDrawTimeStr).getTime() : Date.now();
            const now = Date.now();
            const elapsedSinceDraw = now - lastDraw;
            const isDrumRoll = elapsedSinceDraw < 3000 && drawnNumbers.length > 0; // 3s Buffer

            return (
              <>
                <p className="text-sm font-black text-white/60 mb-1">
                  RODADA {roundNumber}/{totalRounds}
                </p>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">
                  {isPaused ? 'SORTEIO PAUSADO' :
                    isDrumRoll ? 'SINCRONIZANDO...' : `PRÓXIMO EM ${timeLeft}S`
                  }
                </p>
                <div className={`size-64 bg-white rounded-full flex flex-col items-center justify-center shadow-[0_0_120px_rgba(255,61,113,0.3)] border-[12px] border-primary relative transition-all duration-300 ${isDrumRoll ? 'scale-90 opacity-90' : 'scale-100'}`}>
                  {isDrumRoll ? (
                    <div className="flex flex-col items-center animate-pulse">
                      <span className="material-symbols-outlined text-6xl text-primary/50 animate-spin mb-2">autorenew</span>
                      <span className="text-primary/50 font-black text-xl tracking-widest">SORTEANDO</span>
                    </div>
                  ) : (
                    <>
                      {lastNum && (
                        <span className="text-primary font-black text-2xl absolute top-8 animate-pulse">{getBingoLabel(lastNum)}</span>
                      )}
                      <span className="text-zinc-900 text-[120px] font-black leading-none tabular-nums mt-4">
                        {lastNum || '--'}
                      </span>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Últimas Bolas - Also hide latest if DrumRoll? Optional. 
            Actually, drawnNumbers includes it. We should probably mask the last one in the list too 
            if we want true suspense, otherwise they look at the list.
            Let's Mask the first item of the list if isDrumRoll.
        */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-2 px-1">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Últimas Bolas</p>
            <span className="text-xs font-black text-primary">{drawnNumbers.length}/75</span>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-3 px-1">
            {(() => {
              const lastDrawTimeStr = roomInfo?.updated_at || localStorage.getItem('bingola_last_draw_time');
              const lastDraw = lastDrawTimeStr ? new Date(lastDrawTimeStr).getTime() : Date.now();
              const isDrumRoll = (Date.now() - lastDraw) < 3000 && drawnNumbers.length > 0;

              // If drumroll, we temporarily hide the NEWEST number from the history list too
              // drawnNumbers is [1, 2, 3]. Reverse is [3, 2, 1].
              // We want to show [?, 2, 1] or just [2, 1].
              // Let's show a placeholder.

              const list = [...drawnNumbers].reverse();
              return list.map((n, i) => {
                const isHidden = i === 0 && isDrumRoll;
                return (
                  <div key={i} className={`flex-none size-16 rounded-2xl flex flex-col items-center justify-center font-black border transition-all ${i === 0 ? 'bg-primary border-primary scale-110 shadow-lg' : 'bg-white/5 border-white/10 text-white/30'} ${isHidden ? 'animate-pulse bg-primary/50' : ''}`}>
                    {isHidden ? (
                      <span className="material-symbols-outlined text-white text-2xl animate-spin">autorenew</span>
                    ) : (
                      <>
                        <span className="text-[10px] leading-none mb-1 opacity-60 mt-1">{getBingoLabel(n)}</span>
                        <span className="text-2xl leading-none mb-1">{n}</span>
                      </>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Logic for Missing Card Fallback */}
        {(!grid || grid.length === 0) ? (
          <div className="w-full max-w-sm min-h-[400px] bg-white/5 rounded-[2.5rem] flex flex-col items-center justify-center border-2 border-white/10 border-dashed animate-pulse my-4 p-8">
            <span className="material-symbols-outlined text-white/40 text-6xl mb-4">grid_on</span>
            <p className="text-white/60 text-lg font-black uppercase tracking-widest mb-2">Carregando Cartela...</p>
            <p className="text-white/30 text-xs text-center">Estamos preparando seus números da sorte.</p>
          </div>
        ) : (
          <div className={`w-full max-w-sm min-h-[450px] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 mb-4 flex flex-col ${(theme && theme.cardBg) ? theme.cardBg : 'bg-surface-dark'} ${(theme && theme.border) ? theme.border : 'border-white/10'}`}>
            <div className="h-16 flex items-center justify-around shadow-md relative z-10" style={{ backgroundColor: cardCustom.cardColor || '#FF3D71' }}>
              {['B', 'I', 'N', 'G', 'O'].map(l => <span key={l} className="text-white font-black text-3xl drop-shadow-md">{l}</span>)}
            </div>
            <div className="grid grid-cols-5 gap-2 p-4 bg-black/10 flex-1 content-start">
              {grid.flat().map((num, i) => {
                const isDrawn = num === 0 || drawnNumbers.includes(num);
                const isMarked = marked.includes(num);
                const assist = assistMode && isDrawn && !isMarked && num !== 0;

                return (
                  <button
                    key={i}
                    onClick={() => markNumber(num)}
                    disabled={!isDrawn && num !== 0}
                    className={`aspect-square w-full rounded-2xl flex items-center justify-center relative border-2 transition-all duration-200  
                      ${num === 0 ? 'bg-primary/10 border-primary/20' : `${(theme && theme.cellBg) ? theme.cellBg : 'bg-white/5'} ${(theme && theme.border) ? theme.border : 'border-white/5'} ${(theme && theme.textColor) ? theme.textColor : 'text-white'}`} 
                      ${(assistMode && !isDrawn) ? 'opacity-40 blur-[0.5px]' : 'opacity-100'} 
                      ${assist ? 'ring-4 ring-primary ring-inset animate-pulse z-20 scale-105' : ''}
                      ${isMarked && num !== 0 ? 'scale-95' : 'active:scale-95 hover:brightness-110'}
                    `}
                  >
                    {num === 0 ? (
                      <span className="text-[8px] font-black text-primary text-center leading-tight tracking-wider">BINGOLA<br />LIVRE</span>
                    ) : (
                      <span className="text-2xl font-black">{num}</span>
                    )}

                    {/* Stamp Animation */}
                    {isMarked && num !== 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 duration-300" style={{ opacity: (cardCustom.opacity || 100) / 100 }}>
                        <span className="material-symbols-outlined text-5xl drop-shadow-lg transform rotate-[-15deg]" style={{ color: cardCustom.cardColor || '#FF3D71' }}>{cardCustom.stampIcon || 'stars'}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bingo Button */}
        <button
          onClick={handleBingo}
          disabled={isPaused}
          className={`w-full h-24 shrink-0 mt-6 mb-6 font-black text-5xl rounded-[3rem] shadow-[0_10px_40px_-10px_rgba(255,61,113,0.5)] active:scale-95 active:shadow-none transition-all italic tracking-tighter flex items-center justify-center gap-4 relative overflow-hidden group
             ${isPaused ? 'bg-gray-600 text-white/20 cursor-not-allowed' : 'bg-primary text-white hover:bg-red-500'}
           `}>
          <span className="relative z-10">BINGO!</span>
          <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
        </button>

        {
          (() => {
            const potRaw = roomInfo?.prize_pool || roomInfo?.prizePool || roomInfo?.prize_pot || roomInfo?.bpoints || 0;
            const pot = Number(potRaw);
            const secPrize = claimedPrizes.find(p => p.type !== 'Cartela Cheia');

            const formatValue = (val: number) => val.toFixed(2).replace('.', ',');

            return (
              <div className="w-full max-w-sm space-y-3">
                <div className={`border rounded-2xl p-4 transition-all ${secPrize ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">30% DO POTE DA RODADA</p>
                    {secPrize && <span className="text-[8px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">SAIU!</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-black text-sm ${secPrize ? 'text-green-500' : 'text-white'}`}>
                        {secPrize ? secPrize.type : 'Prêmio Secundário'}
                      </p>
                      <p className="text-[10px] font-bold text-white/40">
                        {secPrize ? `Vencedor: ${secPrize.winner}` : 'Aguardando vencedor...'}
                      </p>
                    </div>
                    <p className={`font-black ${secPrize ? 'text-green-500' : 'text-white/60'}`}>B$ {formatValue(Math.floor(pot * 0.3))}</p>
                  </div>
                </div>

                <div className={`border rounded-2xl p-4 transition-all ${claimedPrizes.some(p => p.type === 'Cartela Cheia') ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">70% DO POTE DA RODADA</p>
                    {claimedPrizes.some(p => p.type === 'Cartela Cheia') && <span className="text-[8px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">FINALIZOU!</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-black text-sm ${claimedPrizes.some(p => p.type === 'Cartela Cheia') ? 'text-green-500' : 'text-white'}`}>Cartela Cheia</p>
                      <p className="text-[10px] font-bold text-white/40">
                        {claimedPrizes.find(p => p.type === 'Cartela Cheia')?.winner ? `Vencedor: ${claimedPrizes.find(p => p.type === 'Cartela Cheia').winner}` : 'Boa sorte! 🧿'}
                      </p>
                    </div>
                    <p className={`font-black ${claimedPrizes.some(p => p.type === 'Cartela Cheia') ? 'text-green-500' : 'text-white/60'}`}>B$ {formatValue(Math.floor(pot * 0.7))}</p>
                  </div>
                </div>
              </div>
            );
          })()
        }
      </main >

      {
        errorMsg && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-6">
            <div className="bg-red-500 text-white px-8 py-4 rounded-full font-black text-sm uppercase shadow-[0_0_50px_rgba(239,68,68,0.5)] animate-bounce text-center">
              {errorMsg}
            </div>
          </div>
        )
      }

      {
        showRulesInfo && (
          <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowRulesInfo(false)}>
            <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowRulesInfo(false)} className="absolute top-6 right-6 text-white/40"><span className="material-symbols-outlined">close</span></button>
              <div className="mb-6">
                <h3 className="text-xl font-black text-white italic leading-tight uppercase">Regras da Mesa</h3>
                <p className="text-primary font-black text-xs tracking-[0.2em] italic">CÓD MESA: {roomInfo.code}</p>
              </div>
              <div className="space-y-3 mb-6">
                {Object.entries((roomInfo as any)?.winning_patterns || { cheia: true }).filter(([_, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl capitalize">
                    <span className="material-symbols-outlined text-primary">verified</span>
                    <p className="font-bold text-sm text-white">{k === 'cheia' ? 'Cartela Cheia' : k}</p>
                  </div>
                ))}
              </div>

              {isHost && (
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">Configurar Ritmo (Segundos)</p>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-2xl font-black text-white w-12 text-center">{newInterval}s</span>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="1"
                      value={newInterval}
                      onChange={(e) => setNewInterval(Number(e.target.value))}
                      className="flex-1 accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <button onClick={saveRhythm} className="w-full h-12 bg-primary text-white font-black rounded-2xl text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all">SALVAR RITMO</button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        showAuthModal && (
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

                  {/* Always show Host/Me if I am host */}
                  {isHost && currentUserProfile && (
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl opacity-60 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={currentUserProfile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full" />
                          <div className="absolute -top-1 -right-1 bg-yellow-500 text-black size-4 rounded-full flex items-center justify-center border border-background-dark">
                            <span className="material-symbols-outlined text-[8px] font-black">crown</span>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-white/90">{currentUserProfile.username || 'Você'} <span className="text-[10px] opacity-50">(Host)</span></span>
                      </div>
                      <span className="material-symbols-outlined text-green-500/40 text-sm">check_circle</span>
                    </div>
                  )}

                  {acceptedList.length === 0 && !isHost ? (
                    <p className="text-center text-white/30 text-[10px] py-4 italic">Nenhum outro jogador.</p>
                  ) : acceptedList.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayer({
                        userId: p.user_id,
                        name: p.profiles?.username || 'Jogador',
                        avatar: p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
                        level: p.profiles?.level || 1,
                        bcoins: p.profiles?.bcoins || 0
                      })}
                      className="w-full flex items-center justify-between bg-white/5 p-4 rounded-2xl active:scale-[0.98] transition-all hover:bg-white/[0.08]"
                    >
                      <div className="flex items-center gap-3">
                        <img src={p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full grayscale" alt="Player Avatar" />
                        <span className="font-bold text-sm text-white/70">{p.profiles?.username || 'Jogador'}</span>
                      </div>
                      <span className="material-symbols-outlined text-green-500/40 text-sm">check_circle</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl uppercase">Fechar</button>
            </div>
          </div>
        )
      }

      {
        showEndGameModal && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl text-center">
              <div className="size-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-red-500">power_settings_new</span>
              </div>
              <h3 className="text-xl font-black text-white italic leading-tight uppercase mb-4">Encerrar Mesa?</h3>
              <p className="text-sm text-white/50 mb-8">
                Tem certeza que deseja encerrar esta mesa definitivamente? Todos os jogadores serão desconectados.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndGameModal(false)} className="flex-1 h-14 bg-white/5 text-white/40 font-black rounded-2xl uppercase hover:bg-white/10 transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmEndGame} className="flex-1 h-14 bg-red-500 text-white font-black rounded-2xl uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all">
                  Encerrar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        winnerAnnouncement && (
          <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-surface-dark w-full max-w-sm rounded-[3.5rem] border-2 border-primary shadow-2xl text-center relative overflow-hidden flex flex-col max-h-[85vh]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary z-20"></div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                      <p className="text-green-500 font-black text-4xl tabular-nums">B$ {winnerAnnouncement.value.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </>
                ) : (
                  // LOSER VIEW (Refined)
                  <>
                    <p className="text-white/30 font-black text-[10px] uppercase tracking-[0.4em] mb-4">NÃO DEU PRA VOCÊ...</p>
                    <div className="size-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6 grayscale opacity-50">
                      <span className="material-symbols-outlined text-5xl text-white">sentiment_dissatisfied</span>
                    </div>

                    <h3 className="text-2xl font-black italic text-white/60 mb-8 leading-tight uppercase">MAIS SORTE NA PRÓXIMA!</h3>

                    <div className="mb-8">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">VENCEDOR</p>
                      <p className="text-xl font-bold text-white mb-1">{winnerAnnouncement.winner}</p>
                      <p className="text-xs text-primary font-bold uppercase">{winnerAnnouncement.type === 'Cartela Cheia' ? 'CARTELA CHEIA' : `Prêmio: ${winnerAnnouncement.type}`}</p>
                    </div>

                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 mb-6 opacity-60">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">NÚMEROS DA VITÓRIA</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {winnerAnnouncement.winningNumbers?.map((n: any) => (
                          <div key={n} className="size-8 rounded-full bg-primary text-white font-black flex items-center justify-center text-sm shadow-md">
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 mb-8 opacity-60">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">VALOR DO PRÊMIO</p>
                      <p className="text-green-500 font-black text-2xl tabular-nums">B$ {winnerAnnouncement.value.toFixed(2).replace('.', ',')}</p>
                    </div>

                    <p className="text-xs text-white/40 mb-4 px-4 leading-relaxed">
                      Bora para a {winnerAnnouncement.type !== 'Cartela Cheia' ? 'cartela cheia' : 'próxima rodada'}!
                    </p>
                  </>
                )}
              </div>

              <div className="p-6 pt-0 bg-surface-dark z-20">
                {isHost ? (
                  winnerAnnouncement.type !== 'Cartela Cheia' ? (
                    <button onClick={togglePause} className="w-full h-16 bg-primary text-white font-black rounded-3xl text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all">CONTINUAR JOGO</button>
                  ) : (
                    roundNumber < totalRounds ? (
                      <button onClick={handleNextRound} className="w-full h-16 bg-primary text-white font-black rounded-3xl text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all">PRÓXIMA RODADA</button>
                    ) : (
                      <button onClick={handleFinish} className="w-full h-16 bg-red-500 text-white font-black rounded-3xl text-lg shadow-xl shadow-red-500/20 active:scale-95 transition-all">FINALIZAR MESA</button>
                    )
                  )
                ) : (
                  <button
                    onClick={() => setWinnerAnnouncement(null)}
                    className="w-full h-16 bg-white/5 text-white/40 font-black rounded-3xl uppercase hover:bg-white/10 transition-colors"
                  >
                    FECHAR
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }
      {/* Exit Confirmation Modal */}
      {
        showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-dark w-full max-w-sm rounded-[2rem] p-6 border border-white/10 shadow-2xl space-y-4">
              <div className="text-center space-y-2">
                <div className="size-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-white">logout</span>
                </div>
                <h3 className="text-xl font-black text-white">Sair da Mesa?</h3>
                <p className="text-white/60 text-sm">Você pode sair temporariamente ou encerrar a mesa.</p>
              </div>

              <div className="grid gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onBack(); // Just navigate back, treated as temporary exit
                  }}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                >
                  Sair Temporariamente
                </button>

                {!isHost && (
                  <button
                    onClick={handleLeavePermanent}
                    className="w-full h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">exit_to_app</span>
                    Sair Definitivamente
                  </button>
                )}

                {isHost && (
                  <button
                    onClick={confirmEndGame}
                    className="w-full h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">power_settings_new</span>
                    Encerrar Mesa
                  </button>
                )}

                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full h-12 text-white/40 font-bold hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Voice Selection Modal */}
      {
        showVoiceModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowVoiceModal(false)}>
            <div className="bg-surface-dark w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-primary mb-2">record_voice_over</span>
                <h3 className="text-2xl font-black italic">Voz do Locutor</h3>
                <p className="text-white/40 text-xs">Selecione o estilo da narração</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'vovo', name: 'Vovô do Bingo', desc: 'Clássico e acolhedor', icon: 'elderly' },
                  { id: 'radio', name: 'Locutor de Rádio', desc: 'Energia máxima', icon: 'radio' },
                  { id: 'suave', name: 'Voz Suave', desc: 'Partida relaxada', icon: 'sentiment_satisfied' }
                ].map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => { setVoice(voice.id); setShowVoiceModal(false); }}
                    className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${selectedVoice === voice.id ? 'bg-primary/10 border-primary text-white' : 'bg-white/5 border-transparent text-white/60'}`}
                  >
                    <span className="material-symbols-outlined">{voice.icon}</span>
                    <div className="text-left">
                      <p className="font-bold text-sm leading-none">{voice.name}</p>
                      <p className="text-[10px] opacity-40 mt-1">{voice.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowVoiceModal(false)}
                className="w-full h-14 bg-white/5 text-white/40 font-black rounded-2xl uppercase tracking-widest text-[10px]"
              >
                FECHAR
              </button>
            </div>
          </div>
        )
      }

      {/* Player Profile Modal (Game Version) */}
      {
        selectedPlayer && (
          <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setSelectedPlayer(null)}>
            <div className="bg-surface-dark border border-white/10 p-8 rounded-[3rem] w-full max-w-sm text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="absolute top-6 right-6 size-10 bg-white/5 rounded-full flex items-center justify-center text-white/20"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <div className="size-24 rounded-full border-4 border-primary/20 mx-auto mb-6 p-1">
                <img src={selectedPlayer.avatar} className="size-full rounded-full object-cover" alt="Selected Player" />
              </div>
              <h3 className="text-2xl font-black italic mb-1">{selectedPlayer.name}</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-8">Nível {selectedPlayer.level} • {selectedPlayer.bcoins} BCOINS</p>

              {selectedPlayer.userId !== currentUserId && (
                <div className="flex flex-col gap-4 w-full">
                  {/* QUICK MESSAGE BOX */}
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-left ml-2">Mandar um Oi 💨</p>
                    <div className="relative">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Alguma mensagem?..."
                        className="w-full h-12 bg-black/20 border border-white/5 rounded-2xl px-4 pr-12 text-sm font-medium outline-none focus:border-primary/30 transition-all font-sans"
                        onKeyDown={async (e: any) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const val = e.target.value;
                            await useChatStore.getState().sendDirectMessage(selectedPlayer.userId, val);
                            useNotificationStore.getState().show("Mensagem enviada!", 'success');
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={async (e) => {
                          const input = e.currentTarget.previousSibling as HTMLInputElement;
                          if (input.value.trim()) {
                            await useChatStore.getState().sendDirectMessage(selectedPlayer.userId, input.value);
                            useNotificationStore.getState().show("Mensagem enviada!", 'success');
                            input.value = '';
                          }
                        }}
                        className="absolute right-1 top-1 size-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-xl">send</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full max-h-[30vh] overflow-y-auto no-scrollbar">
                    <button
                      onClick={async () => {
                        if (!selectedPlayer.userId) return;
                        await useFriendshipStore.getState().sendRequest(selectedPlayer.userId);
                        useNotificationStore.getState().show("Pedido enviado!", 'success');
                        setSelectedPlayer(null);
                      }}
                      className="w-full min-h-[56px] bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all text-sm uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-primary">person_add</span>
                      ADICIONAR AMIGO
                    </button>

                    {isHost && selectedPlayer.userId !== currentUserId && (
                      <button
                        onClick={async () => {
                          if (!roomId) return;
                          await useRoomStore.getState().hardExit(roomId, selectedPlayer.userId);
                          useNotificationStore.getState().show("Jogador removido!", 'info');
                          setSelectedPlayer(null);
                        }}
                        className="w-full min-h-[56px] bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all text-sm uppercase tracking-widest"
                      >
                        <span className="material-symbols-outlined">person_remove</span>
                        REMOVER DA MESA
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="w-full min-h-[60px] bg-primary text-white font-bold rounded-2xl mt-4 uppercase tracking-[0.2em] italic"
                    >
                      FECHAR
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};