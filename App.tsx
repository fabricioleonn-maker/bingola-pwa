
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { SplashScreen } from './screens/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { ParticipantLobby } from './screens/ParticipantLobby';
import { GameScreen } from './screens/GameScreen';
import { HostDashboard } from './screens/HostDashboard';
import { StoreScreen } from './screens/StoreScreen';
import { RankingScreen } from './screens/RankingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WinnersScreen } from './screens/WinnersScreen';
import { CustomizationScreen } from './screens/CustomizationScreen';
import { MessageCenter } from './screens/MessageCenter';
import { GameSettingsScreen } from './screens/GameSettingsScreen';
import { AudioSettingsScreen } from './screens/AudioSettingsScreen';
import { RulesSettingsScreen } from './screens/RulesSettingsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { SocialScreen } from './screens/SocialScreen';
import { AppScreen } from './types';
import { useRoomStore } from './state/roomStore';
import { useRoomSession } from './state/useRoomSession';
import { readPersistedRoomId, canAutoResume, setNoResume, clearBingolaLocalState } from './state/persist';
import { useTutorialStore } from './state/tutorialStore';
import { useNotificationStore } from './state/notificationStore';
import { NotificationToast } from './components/NotificationToast';

import { PersistentGameLoop } from './components/PersistentGameLoop';
import BackgroundMusic from './components/BackgroundMusic';
import GlobalMusicHeader from './components/GlobalMusicHeader';
import TutorialOverlay from './components/TutorialOverlay';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customReturnScreen, setCustomReturnScreen] = useState<AppScreen>('home');
  const [audioReturnScreen, setAudioReturnScreen] = useState<AppScreen>('home');
  const roomId = useRoomStore(s => s.roomId);
  const setRoomId = useRoomStore(s => s.setRoomId);
  const activeRoom = useRoomStore(s => s.room);

  // Used to ensure only the latest watchdog run takes effect
  const runTokenRef = useRef(0);

  // Single source of truth for realtime session
  useRoomSession(roomId);

  const [mySessionId] = useState(Math.random().toString(36).substring(7));
  const drawIntervalRef = useRef<any>(null);

  const { show: showNotify } = useNotificationStore();

  useEffect(() => {
    // 1. Check initial session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
        } else {
          setCurrentScreen('login');
        }
      } catch (e) {
        console.error("Auth init error:", e);
        setSession(null);
        setCurrentScreen('login');
      } finally {
        setLoading(false);
      }
    };
    initSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        clearBingolaLocalState();
        setRoomId(null);
        setCurrentScreen('login');
      }
    });

    // 3. Realtime Social Listeners (if user exists)
    let dmChannel, friendChannel, hostChannel;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setRoomId(localStorage.getItem('bingola_room_id'));

        dmChannel = supabase.channel('global_dms')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${data.user.id}`
          }, async (payload) => {
            const { data: sender } = await supabase.from('profiles').select('username').eq('id', payload.new.sender_id).single();
            showNotify(`DM de ${sender?.username || 'Amigo'}: ${payload.new.content}`, 'info');
            const { useChatStore } = await import('./state/chatStore');
            useChatStore.getState().fetchDirectMessages(payload.new.sender_id);
          })
          .subscribe();

        friendChannel = supabase.channel('global_friends')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friendships',
            filter: `friend_id=eq.${data.user.id}`
          }, (payload) => {
            if (payload.new.status === 'pending') {
              showNotify("Novo pedido de amizade!", 'success');
            }
          })
          .subscribe();

        hostChannel = supabase.channel('global_host_requests')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'participants',
            filter: 'status=eq.pending'
          }, async (payload) => {
            const { data: room } = await supabase.from('rooms').select('host_id, name').eq('id', payload.new.room_id).single();
            if (room?.host_id === data.user?.id) {
              showNotify(`Novo pedido na mesa: ${room.name}`, 'info');
            }
          })
          .subscribe();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (dmChannel) supabase.removeChannel(dmChannel);
      if (friendChannel) supabase.removeChannel(friendChannel);
      if (hostChannel) supabase.removeChannel(hostChannel);
    };
  }, [showNotify, setRoomId]);

  // 1. Session claim & Tutorial Sync
  useEffect(() => {
    if (session?.user?.id) {
      supabase.from('profiles').update({ active_session_id: mySessionId }).eq('id', session.user.id);

      // Fetch tutorial status (ONLY ONCE per session)
      supabase.from('profiles').select('has_seen_tutorial').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) {
            const hasSeen = !!data.has_seen_tutorial;
            useTutorialStore.setState({ hasSeenTutorial: hasSeen });

            // Auto-start tutorial ONLY if:
            // - Has NOT seen it
            // - Tutorial is NOT already active
            // - We are currently on the 'home' screen
            const tutorialActive = useTutorialStore.getState().isActive;
            if (!hasSeen && !tutorialActive && currentScreen === 'home') {
              console.log("[Tutorial] First time user detected. Auto-starting sequence...");
              useTutorialStore.getState().startTutorial();
            }
          }
        });
    }
  }, [session?.user?.id, mySessionId]); // Removed currentScreen dependency to fix infinite loop <!-- id: 19 -->

  // 1b. Deep Link Join Handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    const isTrusted = urlParams.get('trusted') === '1';

    if (joinCode && session?.user && currentScreen === 'home') {
      console.log("[App] Deep link detected! Code:", joinCode, "Trusted:", isTrusted);

      const handleDeepJoin = async () => {
        // Clear param from URL without refreshing
        window.history.replaceState({}, document.title, window.location.origin);

        try {
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id, player_limit, name')
            .eq('code', joinCode)
            .neq('status', 'finished')
            .single();

          if (roomError || !roomData) throw new Error('Mesa não encontrada.');

          // Full check
          const { count } = await supabase
            .from('participants')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomData.id)
            .eq('status', 'accepted');

          if (count !== null && (count + 1) >= (roomData.player_limit || 20)) {
            throw new Error('Mesa cheia.');
          }

          // Ban check
          const { data: ban } = await supabase
            .from('room_bans')
            .select('rejection_count')
            .eq('room_id', roomData.id)
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (ban && ban.rejection_count >= 2) throw new Error('Banido permanentemente.');

          // Use Store's join helper
          await useRoomStore.getState().joinRoomWithStatus(
            roomData.id,
            session.user.id,
            isTrusted ? 'accepted' : 'pending'
          );

          clearBingolaLocalState();
          useRoomStore.getState().setRoomId(roomData.id);
          setCurrentScreen('participant_lobby');
        } catch (e: any) {
          console.warn("[App] Join failed:", e.message);
          useNotificationStore.getState().show(e.message || "Erro no link", 'error');
        }
      };

      handleDeepJoin();
    }
  }, [session?.user, currentScreen, setCurrentScreen, setRoomId]); // Removed joinCode and fixed dependencies <!-- id: 11 -->

  // 2. Watchdog: periodic sync
  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    runTokenRef.current += 1;
    const myToken = runTokenRef.current;

    const run = async () => {
      // 0. Tutorial Bypass: Don't interfere if tutorial is active or mock room is set
      const tutorialActive = useTutorialStore.getState().isActive;
      if (tutorialActive || roomId === 'tutorial-mock') return;

      // Small delay to allow consecutive state updates to settle
      await new Promise(r => setTimeout(r, 500));
      if (cancelled || myToken !== runTokenRef.current) return;

      const critical: AppScreen[] = ['lobby', 'game', 'participant_lobby', 'winners'];

      // If we are in a critical screen, verify the room is still active
      if (roomId && critical.includes(currentScreen)) {
        const { data: currentRoom } = await supabase
          .from('rooms')
          .select('id, status')
          .eq('id', roomId)
          .maybeSingle();

        if (!currentRoom || currentRoom.status === 'finished') {
          console.log(`[Watchdog] Room ${roomId} invalid or finished. Cleanup triggered.`);
          clearBingolaLocalState();
          setRoomId(null);
          setCurrentScreen('home');
          return;
        }
        return; // Current room is still valid
      }

      if (!canAutoResume(60000)) {
        if (currentScreen === 'splash') setCurrentScreen('home');
        return;
      }

      const persistedId = readPersistedRoomId();
      if (!persistedId) {
        if (currentScreen === 'splash') setCurrentScreen('home');
        return;
      }

      // Host check
      const { data: hosted } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('host_id', session.user.id)
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hosted?.id) {
        if (cancelled) return;
        // Reinforce guard just in case state changed during async calls
        if (roomId && critical.includes(currentScreen)) return;

        setRoomId(hosted.id);
        if (hosted.status === 'playing') {
          const allowedInGame = ['game', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat'];
          if (!allowedInGame.includes(currentScreen)) setCurrentScreen('game');
        } else {
          // Allow 'home' and main tabs so host can manage the app without being force-ejected from lobby context
          const lobbyScreens: AppScreen[] = [
            'lobby', 'game', 'host_dashboard', 'room_settings', 'audio_settings', 'rules_settings',
            'customization', 'home', 'ranking', 'store', 'profile', 'messages', 'chat', 'friends'
          ];
          if (!lobbyScreens.includes(currentScreen)) setCurrentScreen('lobby');
        }
        return;
      }

      console.log("App Watchdog: Check", { screen: currentScreen });
      // Participant check
      const { data: part } = await supabase
        .from('participants')
        .select('room_id, status, rooms!inner(status)')
        .eq('user_id', session.user.id)
        .in('status', ['pending', 'accepted', 'rejected'])
        .neq('rooms.status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("App Watchdog: Part result:", part);

      if (part?.room_id) {
        if (cancelled) return;
        // Reinforce guard
        if (roomId && critical.includes(currentScreen)) return;

        setRoomId(part.room_id);
        const rSt = (part as any).rooms?.status;

        // NEW: Handle Rejection Globally
        if (part.status === 'rejected') {
          console.log("App Watchdog: User is REJECTED. Forcing Lobby.");
          // Ensure we are in the room context (setRoomId) but on the correct screen
          if (roomId !== part.room_id) setRoomId(part.room_id);
          if (currentScreen !== 'participant_lobby') setCurrentScreen('participant_lobby');
          return;
        }

        if (rSt === 'playing') {
          // STRICT SECURITY CHECK: Only accepted players can be in game
          if (part.status === 'accepted') {
            // Allow 'customization' and 'audio_settings' so we don't force loop back to game
            // Allow 'customization', 'audio_settings', and main tabs so users can leave temporarily
            const allowedInGame = ['game', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat', 'friends'];
            if (!allowedInGame.includes(currentScreen)) setCurrentScreen('game');
          } else {
            // If pending, rejected, or anything else, they CANNOT be in game.
            // Force them to participant_lobby (waiting room).
            if (currentScreen !== 'participant_lobby') setCurrentScreen('participant_lobby');
          }
        } else {
          // If NOT playing (e.g. waiting), they should NOT be in 'game'.
          const partLobbyScreens: AppScreen[] = ['participant_lobby', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat', 'friends'];
          if (!partLobbyScreens.includes(currentScreen)) setCurrentScreen('participant_lobby');
        }
        return;
      }

      // Cleanup if no active room found 
      console.log("App Watchdog: No active participation found. Cleaning up.");
      // 6. Cleanup if no active room found but we are in a room screen
      if ((roomId || currentScreen === 'lobby' || currentScreen === 'participant_lobby' || currentScreen === 'game') && !tutorialActive) {
        console.log(`[Watchdog] Final fallback cleanup. roomId=${roomId}, screen=${currentScreen}`);
        clearBingolaLocalState();
        setRoomId(null);
        setCurrentScreen('home');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [session?.user?.id, currentScreen, roomId]);

  const navigateToCustom = (from: AppScreen) => {
    setCustomReturnScreen(from);
    setCurrentScreen('customization');
  };

  const navigateToAudio = (from: AppScreen) => {
    setAudioReturnScreen(from);
    setCurrentScreen('audio_settings');
  };

  const renderScreen = () => {
    if (loading && currentScreen === 'splash') return <SplashScreen />;

    switch (currentScreen) {
      case 'splash': return <SplashScreen />;
      case 'login': return <LoginScreen onLogin={() => setCurrentScreen('home')} onGoToRegister={() => setCurrentScreen('register')} />;
      case 'register': return <RegisterScreen onBack={() => setCurrentScreen('login')} onComplete={() => setCurrentScreen('home')} />;
      case 'home': return <HomeScreen onNavigate={setCurrentScreen} />;
      case 'lobby': return <LobbyScreen
        onBack={() => setCurrentScreen('home')}
        onStart={() => setCurrentScreen('game')}
        onNavigate={(s) => {
          if (s === 'customization') navigateToCustom('lobby');
          else if (s === 'audio_settings') navigateToAudio('lobby');
          else setCurrentScreen(s);
        }}
      />;
      case 'participant_lobby': return <ParticipantLobby
        onBack={() => {
          const uid = session?.user?.id;
          if (uid && roomId) useRoomStore.getState().hardExit(roomId, uid);
          setCurrentScreen('home');
        }}
        onNavigate={(s) => s === 'customization' ? navigateToCustom('participant_lobby') : setCurrentScreen(s)}
      />;
      case 'game': return activeRoom?.id ? (
        <GameScreen
          roomInfo={activeRoom}
          onBack={() => {
            setCurrentScreen('home');
            // Do NOT clear state here. GameScreen handles "Permanent Exit". 
            // "Temporary Exit" just navigates home.
          }}
          onWin={() => setCurrentScreen('winners')}
          onNavigate={(s) => {
            if (s === 'customization') navigateToCustom('game');
            else if (s === 'audio_settings') navigateToAudio('game');
            else setCurrentScreen(s);
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[100dvh] text-white/50 bg-background-dark p-8 text-center">
          <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
          <p className="animate-pulse mb-2 text-white font-black italic uppercase tracking-widest">Sincronizando mesa...</p>
          <p className="text-[10px] text-white/30 max-w-[200px] mb-8">Aguardando dados oficiais do servidor. Verifique sua conexão.</p>

          <div className="flex flex-col gap-4 w-full max-w-[200px]">
            <button
              onClick={() => setCurrentScreen('home')}
              className="w-full h-12 bg-white/5 text-white/40 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Voltar para Home
            </button>

            <button onClick={() => {
              setNoResume();
              clearBingolaLocalState();
              useRoomStore.getState().setRoomId(null);
              setCurrentScreen('home');
              window.location.reload();
            }} className="w-full h-12 border border-red-500/20 text-red-500/60 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
              Travou? Forçar Saída
            </button>
          </div>
        </div>
      );
      case 'host_dashboard': return <HostDashboard onBack={() => setCurrentScreen('home')} onPublish={() => setCurrentScreen('lobby')} onNavigate={setCurrentScreen} />;
      case 'store': return <StoreScreen onBack={() => setCurrentScreen('home')} />;
      case 'ranking': return <RankingScreen onBack={() => setCurrentScreen('home')} />;
      case 'profile': return <ProfileScreen onBack={() => setCurrentScreen('home')} onNavigate={(s) => s === 'customization' ? navigateToCustom('profile') : setCurrentScreen(s)} />;
      case 'winners': return <WinnersScreen onBack={() => setCurrentScreen('home')} />;
      case 'customization': return <CustomizationScreen onBack={() => setCurrentScreen(customReturnScreen)} />;
      case 'messages': return <MessageCenter onBack={() => setCurrentScreen('home')} />;
      case 'room_settings': return <GameSettingsScreen onBack={() => setCurrentScreen('lobby')} onNavigate={(s) => {
        if (s === 'customization') navigateToCustom('room_settings');
        else if (s === 'audio_settings') navigateToAudio('room_settings');
        else setCurrentScreen(s);
      }} />;
      case 'audio_settings': return <AudioSettingsScreen onBack={() => setCurrentScreen(audioReturnScreen)} onNavigate={setCurrentScreen} />;
      case 'rules_settings': return <RulesSettingsScreen onBack={() => setCurrentScreen('room_settings')} />;
      case 'chat': return <ChatScreen onBack={() => {
        const s = useRoomStore.getState();
        if (s.room?.status === 'playing') setCurrentScreen('game');
        else setCurrentScreen(s.room?.host_id === s.currentUserId ? 'lobby' : 'participant_lobby');
      }} />;
      case 'friends': return <SocialScreen onBack={() => setCurrentScreen('home')} onNavigate={setCurrentScreen} />;
      case 'edit_card': return <CustomizationScreen onBack={() => setCurrentScreen('participant_lobby')} />;
      default: return <HomeScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="bg-background-dark min-h-[100dvh]">
      <div className="max-w-[430px] mx-auto min-h-[100dvh] relative shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <NotificationToast />
        <PersistentGameLoop />
        <BackgroundMusic currentScreen={currentScreen} />
        <GlobalMusicHeader currentScreen={currentScreen} />
        <TutorialOverlay onNavigate={setCurrentScreen} />
        <div className="flex-1 relative flex flex-col">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
};

export default App;
