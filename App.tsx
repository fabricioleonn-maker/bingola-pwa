
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
import { RewardNotificationModal } from './components/RewardNotificationModal';

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

  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const [isSessionClaimed, setIsSessionClaimed] = useState(false);

  // Track global activity for 3-minute inactivity logout
  useEffect(() => {
    const handleActivity = () => setLastInteraction(Date.now());
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);
    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  // Single source of truth for realtime session
  useRoomSession(roomId);

  const [mySessionId] = useState(Math.random().toString(36).substring(7));
  const { show: showNotify } = useNotificationStore();

  useEffect(() => {
    // 1. Check initial session
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          console.log("[App] Initial session found:", initialSession.user.id);
          setSession(initialSession);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[Auth] Event:", event);
      setSession(newSession);

      // ONLY clear state on explicit SIGNED_OUT. 
      // Avoids clearing on transient 'null' sessions during refresh/token-exchange.
      if (event === 'SIGNED_OUT') {
        console.log("[Auth] Signed out. Cleaning up local state.");
        clearBingolaLocalState();
        setRoomId(null);
        setCurrentScreen('login');
      }
    });

    // 3. Realtime Social Listeners (if user exists)
    let dmChannel, friendChannel, hostChannel;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const pId = readPersistedRoomId();
        console.log("[App] User active. Restoring persisted roomId:", pId);
        if (pId) setRoomId(pId);

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
  }, [showNotify, setRoomId, session?.user?.id]);

  // 1. Session claim & Tutorial Sync
  useEffect(() => {
    if (session?.user?.id) {
      setIsSessionClaimed(false); // Reset on user change
      supabase.from('profiles').update({ active_session_id: mySessionId }).eq('id', session.user.id)
        .then(() => {
          console.log("[App] Session claimed in DB:", mySessionId);
          setIsSessionClaimed(true);
        });

      supabase.from('profiles').select('has_seen_tutorial').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) {
            const hasSeen = !!data.has_seen_tutorial;
            useTutorialStore.setState({ hasSeenTutorial: hasSeen });

            const tutorialActive = useTutorialStore.getState().isActive;
            if (!hasSeen && !tutorialActive && currentScreen === 'home') {
              console.log("[Tutorial] First time user detected. Auto-starting sequence...");
              useTutorialStore.getState().startTutorial();
            }
          }
        });
    }
  }, [session?.user?.id, mySessionId]);

  // 1b. Deep Link Join Handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    const isTrusted = urlParams.get('trusted') === '1';

    if (joinCode && session?.user && currentScreen === 'home') {
      const handleDeepJoin = async () => {
        window.history.replaceState({}, document.title, window.location.origin);
        try {
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id, player_limit, name')
            .eq('code', joinCode)
            .neq('status', 'finished')
            .single();

          if (roomError || !roomData) throw new Error('Mesa não encontrada.');

          const { count } = await supabase
            .from('participants')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomData.id)
            .eq('status', 'accepted');

          if (count !== null && (count + 1) >= (roomData.player_limit || 20)) {
            throw new Error('Mesa cheia.');
          }

          const { data: ban } = await supabase
            .from('room_bans')
            .select('rejection_count')
            .eq('room_id', roomData.id)
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (ban && ban.rejection_count >= 2) throw new Error('Banido permanentemente.');

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
  }, [session?.user, currentScreen, setCurrentScreen, setRoomId]);

  // 2. Watchdog: periodic sync
  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    runTokenRef.current += 1;
    const myToken = runTokenRef.current;

    const run = async () => {
      const tutorialActive = useTutorialStore.getState().isActive;
      if (tutorialActive || roomId === 'tutorial-mock') return;

      await new Promise(r => setTimeout(r, 500));
      if (cancelled || myToken !== runTokenRef.current) return;

      // 1. Inactivity Check (15 minutes)
      const inactiveMs = Date.now() - lastInteraction;
      if (inactiveMs > 900000) {
        console.log("[Watchdog] Inactivity timeoutReached. Logging out.");
        showNotify("Sessão encerrada por inatividade (15 min).", 'info');
        if (roomId && session?.user?.id) {
          await useRoomStore.getState().hardExit(roomId, session.user.id);
        }
        await supabase.auth.signOut();
        return;
      }

      // 2. Session Conflict Check
      if (isSessionClaimed) {
        const { data: profile } = await supabase.from('profiles').select('active_session_id').eq('id', session.user.id).single();
        if (profile && profile.active_session_id && profile.active_session_id !== mySessionId) {
          console.log("[Watchdog] Session conflict detected. Logging out.");
          showNotify("Sua conta foi conectada em outro local.", 'error');
          if (roomId && session.user.id) await useRoomStore.getState().hardExit(roomId, session.user.id);
          await supabase.auth.signOut();
          return;
        }
      }

      const critical: AppScreen[] = ['lobby', 'game', 'participant_lobby', 'winners'];

      // If already in a room, verify it's still alive
      if (roomId && critical.includes(currentScreen)) {
        const { data: currentRoom } = await supabase.from('rooms').select('id, status').eq('id', roomId).maybeSingle();
        if (!currentRoom || currentRoom.status === 'finished') {
          console.log(`[Watchdog] Room ${roomId} invalid/finished. Verifying with delay...`);
          await new Promise(r => setTimeout(r, 3000));
          const { data: recheck } = await supabase.from('rooms').select('id, status').eq('id', roomId).maybeSingle();
          if (recheck && recheck.status !== 'finished') return;

          console.log("[Watchdog] Room definitely gone. Cleaning up.");
          clearBingolaLocalState();
          setRoomId(null);
          setCurrentScreen('home');
          return;
        }
        return;
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

      // RESUME LOGIC (when currentScreen is splash/home but persistedId exists)
      console.log("[Watchdog] Attempting restoration for room:", persistedId);

      // Host check
      const { data: hosted } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('host_id', session.user.id)
        .eq('id', persistedId)
        .neq('status', 'finished')
        .maybeSingle();

      if (hosted?.id) {
        if (cancelled) return;
        console.log("[Watchdog] Host role confirmed for room:", hosted.id);
        setRoomId(hosted.id);
        if (hosted.status === 'playing') {
          const allowed = ['game', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat'];
          if (!allowed.includes(currentScreen)) setCurrentScreen('game');
        } else {
          const lobbyScreens: AppScreen[] = ['lobby', 'game', 'host_dashboard', 'room_settings', 'audio_settings', 'rules_settings', 'customization', 'home', 'ranking', 'store', 'profile', 'messages', 'chat', 'friends'];
          if (!lobbyScreens.includes(currentScreen)) setCurrentScreen('lobby');
        }
        return;
      }

      // Participant check
      const { data: part } = await supabase
        .from('participants')
        .select('room_id, status, rooms!inner(status)')
        .eq('user_id', session.user.id)
        .eq('room_id', persistedId)
        .in('status', ['pending', 'accepted', 'rejected'])
        .neq('rooms.status', 'finished')
        .maybeSingle();

      if (part?.room_id) {
        if (cancelled) return;
        console.log("[Watchdog] Participant role confirmed for room:", part.room_id);
        setRoomId(part.room_id);
        const rSt = (part as any).rooms?.status;

        if (part.status === 'rejected') {
          if (currentScreen !== 'participant_lobby') setCurrentScreen('participant_lobby');
          return;
        }

        if (rSt === 'playing') {
          if (part.status === 'accepted') {
            const allowed = ['game', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat', 'friends'];
            if (!allowed.includes(currentScreen)) setCurrentScreen('game');
          } else {
            if (currentScreen !== 'participant_lobby') setCurrentScreen('participant_lobby');
          }
        } else {
          const partLobbyScreens: AppScreen[] = ['participant_lobby', 'customization', 'audio_settings', 'home', 'store', 'profile', 'ranking', 'messages', 'chat', 'friends'];
          if (!partLobbyScreens.includes(currentScreen)) setCurrentScreen('participant_lobby');
        }
        return;
      }

      // If we reach here, we found a persistedId but NO active role was found in DB
      console.log(`[Watchdog] No role found for user ${session.user.id} in room ${persistedId}.`);
      if ((roomId || currentScreen === 'lobby' || currentScreen === 'participant_lobby' || currentScreen === 'game') && !tutorialActive) {
        console.log("[Watchdog] Wiping stale local state.");
        clearBingolaLocalState();
        setRoomId(null);
        setCurrentScreen('home');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [session?.user?.id, currentScreen, roomId, lastInteraction, isSessionClaimed]);

  const navigateToCustom = (from: AppScreen) => { setCustomReturnScreen(from); setCurrentScreen('customization'); };
  const navigateToAudio = (from: AppScreen) => { setAudioReturnScreen(from); setCurrentScreen('audio_settings'); };

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
          onBack={() => setCurrentScreen('home')}
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
          <div className="flex flex-col gap-4 w-full max-w-[200px] mt-8">
            <button onClick={() => setCurrentScreen('home')} className="w-full h-12 bg-white/5 text-white/40 font-black rounded-xl text-[10px] uppercase tracking-widest">Home</button>
            <button onClick={() => { setNoResume(); clearBingolaLocalState(); useRoomStore.getState().setRoomId(null); window.location.reload(); }} className="w-full h-12 border border-red-500/20 text-red-500/60 font-black rounded-xl text-[10px] uppercase tracking-widest">Forçar Saída</button>
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
      default: return <HomeScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="bg-background-dark min-h-[100dvh]">
      <div className={`max-w-[430px] mx-auto min-h-[100dvh] relative shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)] ${!['login', 'register', 'splash'].includes(currentScreen) ? 'pt-[calc(env(safe-area-inset-top)+40px)]' : 'pt-[env(safe-area-inset-top)]'}`}>
        <NotificationToast />
        <PersistentGameLoop />
        <BackgroundMusic currentScreen={currentScreen} />
        <GlobalMusicHeader currentScreen={currentScreen} />
        <TutorialOverlay onNavigate={setCurrentScreen} />
        <RewardNotificationModal />
        <div className="flex-1 relative flex flex-col">{renderScreen()}</div>
      </div>
    </div>
  );
};

export default App;
