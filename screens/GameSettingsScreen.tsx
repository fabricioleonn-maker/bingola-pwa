
import React, { useState, useEffect } from 'react';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const GameSettingsScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [interval, setIntervalVal] = useState(12);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error' | 'connected'>('idle');
  const [connectedTvName, setConnectedTvName] = useState<string | null>(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem('bingola_game_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setIntervalVal(settings.interval || 12);
      if (settings.connectedTvName) {
        setConnectedTvName(settings.connectedTvName);
        setStatus('connected');
      }
    }
  }, []);

  // Persiste o ritmo imediatamente no localStorage para não perder ao navegar entre sub-telas
  useEffect(() => {
    const currentSettings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    localStorage.setItem('bingola_game_settings', JSON.stringify({ ...currentSettings, interval }));
  }, [interval]);

  const handleSave = () => {
    const currentSettings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    const newSettings = { ...currentSettings, interval, connectedTvName };
    localStorage.setItem('bingola_game_settings', JSON.stringify(newSettings));
    onBack();
  };

  const handleTvClick = async () => {
    if (status === 'connected') {
      setStatus('idle');
      setConnectedTvName(null);
      return;
    }

    setStatus('searching');
    
    // Simulação Técnica Realista:
    // Em browsers, tentaríamos navigator.presentation.requestSession()
    // Se falhar ou não houver hardware, mostramos erro.
    setTimeout(() => {
      const dice = Math.random();
      if (dice > 0.7) { // 30% de chance de "achar" algo (simulado)
        setConnectedTvName("Samsung Crystal UHD 4K");
        setStatus('connected');
      } else {
        setStatus('error');
        setConnectedTvName(null);
        setTimeout(() => setStatus('idle'), 3000); // Volta ao normal após 3s de erro
      }
    }, 2500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display">
      <header className="sticky top-0 z-10 flex items-center bg-white dark:bg-background-dark p-4 border-b border-gray-100 dark:border-white/10 justify-between">
        <button onClick={onBack} className="text-[#181511] dark:text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <h2 className="text-[#181511] dark:text-white text-lg font-bold leading-tight flex-1 text-center pr-12">Configurações da Mesa</h2>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="px-4 mt-6">
          <button 
            onClick={handleTvClick}
            disabled={status === 'searching'}
            className={`w-full rounded-2xl p-4 flex items-center gap-4 border transition-all ${
              status === 'connected' ? 'bg-primary/10 border-primary/20' : 
              status === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-100 dark:bg-white/5 border-white/10'
            }`}
          >
            <div className={`p-2.5 rounded-xl flex items-center justify-center text-white shadow-lg ${
              status === 'searching' ? 'animate-pulse bg-primary/50' : 
              status === 'connected' ? 'bg-primary shadow-primary/20' : 
              status === 'error' ? 'bg-red-500 shadow-red-500/20' : 'bg-gray-400'
            }`}>
              <span className="material-symbols-outlined">
                {status === 'searching' ? 'search' : status === 'connected' ? 'tv' : status === 'error' ? 'error' : 'tv_off'}
              </span>
            </div>
            <div className="flex-1 text-left">
              <h4 className={`text-sm font-bold ${status === 'error' ? 'text-red-500' : 'dark:text-white'}`}>
                {status === 'searching' ? 'Buscando dispositivos...' : 
                 status === 'connected' ? 'Smart TV Conectada' : 
                 status === 'error' ? 'Nenhuma TV Encontrada' : 'Espelhamento de Tela'}
              </h4>
              <p className="text-[#8a7960] dark:text-gray-400 text-xs">
                {status === 'searching' ? 'Certifique-se que a TV está na mesma rede' : 
                 status === 'connected' ? `Transmitindo em "${connectedTvName}"` : 
                 status === 'error' ? 'Certifique-se que o Cast está ativo na TV' : 'Toque para sincronizar com sua TV'}
              </p>
            </div>
            {status === 'connected' && <span className="material-symbols-outlined text-primary">check_circle</span>}
          </button>
        </div>

        <div className="mt-8 px-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#181511] dark:text-white text-lg font-bold">Ritmo do Jogo</h3>
              <span className="text-primary font-black text-sm">{interval}s</span>
            </div>
            <div className="relative flex w-full flex-col gap-4">
              <input 
                type="range" 
                min="5" 
                max="30" 
                value={interval} 
                onChange={(e) => setIntervalVal(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
              />
              <p className="text-[#8a7960] dark:text-gray-400 text-xs">A alteração do ritmo é aplicada imediatamente a todos os participantes ao salvar.</p>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-white/5"></div>

          <section className="space-y-4">
            <h3 className="text-[#181511] dark:text-white text-lg font-bold">Personalização e Extras</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => onNavigate('audio_settings')}
                className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/5 rounded-2xl"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <span className="material-symbols-outlined">volume_up</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Controle de Áudio</p>
                    <p className="text-xs text-gray-400">Locutor, volumes e efeitos</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-300">chevron_right</span>
              </button>

              <button 
                onClick={() => onNavigate('rules_settings')}
                className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/5 rounded-2xl"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <span className="material-symbols-outlined">gavel</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Regras de Vitória</p>
                    <p className="text-xs text-gray-400">Defina os prêmios da mesa</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-300">chevron_right</span>
              </button>

              <button 
                onClick={() => onNavigate('customization')}
                className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/5 rounded-2xl"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <span className="material-symbols-outlined">style</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Estilo da Cartela</p>
                    <p className="text-xs text-gray-400">Cores, temas e marcação</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-300">chevron_right</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-gray-100 dark:border-white/10">
        <button onClick={handleSave} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all">
          CONFIRMAR AJUSTES
        </button>
      </footer>
    </div>
  );
};
