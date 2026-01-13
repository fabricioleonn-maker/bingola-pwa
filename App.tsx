
import React, { useState, useEffect, useRef } from 'react';
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
import { AppScreen } from './types';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [customReturnScreen, setCustomReturnScreen] = useState<AppScreen>('home');
  const drawIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => setCurrentScreen('home'), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Motor de Sorteio em Segundo Plano (Background Draw Engine)
  // Este motor garante que o sorteio continue mesmo que o anfitrião saia da tela de jogo
  useEffect(() => {
    const runBackgroundDraw = () => {
      const isRunning = localStorage.getItem('bingola_game_running') === 'true';
      const isPaused = localStorage.getItem('bingola_is_paused') === 'true';
      const activeRoom = JSON.parse(localStorage.getItem('bingola_active_room') || '{}');
      
      // Apenas o Host processa o sorteio lógico
      if (isRunning && !isPaused && activeRoom.isHost) {
        const lastTime = Number(localStorage.getItem('bingola_last_draw_time') || Date.now());
        const settings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
        const interval = settings.interval || 12;
        const elapsed = Math.floor((Date.now() - lastTime) / 1000);

        if (elapsed >= interval) {
          const currentDrawn = JSON.parse(localStorage.getItem('bingola_drawn_numbers') || '[]');
          if (currentDrawn.length < 75) {
            let next;
            do {
              next = Math.floor(Math.random() * 75) + 1;
            } while (currentDrawn.includes(next));
            
            const updated = [...currentDrawn, next];
            localStorage.setItem('bingola_drawn_numbers', JSON.stringify(updated));
            localStorage.setItem('bingola_last_draw_time', Date.now().toString());
            
            // Dispara evento para avisar telas ativas
            window.dispatchEvent(new CustomEvent('bingola_refresh_state'));
          }
        }
      }
    };

    drawIntervalRef.current = setInterval(runBackgroundDraw, 1000);
    return () => clearInterval(drawIntervalRef.current);
  }, []);

  const navigateToCustom = (from: AppScreen) => {
    setCustomReturnScreen(from);
    setCurrentScreen('customization');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash': return <SplashScreen />;
      case 'login': return <LoginScreen onLogin={() => setCurrentScreen('home')} onGoToRegister={() => setCurrentScreen('register')} />;
      case 'register': return <RegisterScreen onBack={() => setCurrentScreen('login')} onComplete={() => setCurrentScreen('home')} />;
      case 'home': return <HomeScreen onNavigate={setCurrentScreen} />;
      case 'lobby': return <LobbyScreen onBack={() => setCurrentScreen('home')} onStart={() => setCurrentScreen('game')} onNavigate={setCurrentScreen} />;
      case 'participant_lobby': return <ParticipantLobby onBack={() => setCurrentScreen('home')} onNavigate={(s) => s === 'customization' ? navigateToCustom('participant_lobby') : setCurrentScreen(s)} />;
      case 'game': return <GameScreen onBack={() => setCurrentScreen('home')} onWin={() => setCurrentScreen('winners')} onNavigate={setCurrentScreen} />;
      case 'host_dashboard': return <HostDashboard onBack={() => setCurrentScreen('home')} onPublish={() => setCurrentScreen('lobby')} onNavigate={setCurrentScreen} />;
      case 'store': return <StoreScreen onBack={() => setCurrentScreen('home')} />;
      case 'ranking': return <RankingScreen onBack={() => setCurrentScreen('home')} />;
      case 'profile': return <ProfileScreen onBack={() => setCurrentScreen('home')} onNavigate={(s) => s === 'customization' ? navigateToCustom('profile') : setCurrentScreen(s)} />;
      case 'winners': return <WinnersScreen onBack={() => setCurrentScreen('home')} />;
      case 'customization': return <CustomizationScreen onBack={() => setCurrentScreen(customReturnScreen)} />;
      case 'messages': return <MessageCenter onBack={() => setCurrentScreen('home')} />;
      case 'room_settings': return <GameSettingsScreen onBack={() => setCurrentScreen('lobby')} onNavigate={(s) => s === 'customization' ? navigateToCustom('room_settings') : setCurrentScreen(s)} />;
      case 'audio_settings': return <AudioSettingsScreen onBack={() => setCurrentScreen('room_settings')} />;
      case 'rules_settings': return <RulesSettingsScreen onBack={() => setCurrentScreen('room_settings')} />;
      case 'chat': return <ChatScreen onBack={() => setCurrentScreen('game')} />;
      default: return <HomeScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="bg-background-dark min-h-screen">
      <div className="max-w-[430px] mx-auto min-h-screen relative shadow-2xl">
        {renderScreen()}
      </div>
    </div>
  );
};

export default App;
