
import React, { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

export const AudioSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [selectedVoice, setSelectedVoice] = useState('vovo');
  const [narrationVolume, setNarrationVolume] = useState(80);
  const [soundtrackVolume, setSoundtrackVolume] = useState(40);

  useEffect(() => {
    const savedSettings = localStorage.getItem('bingola_game_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setSelectedVoice(settings.selectedVoice || 'vovo');
        setNarrationVolume(settings.narrationVolume ?? 80);
        setSoundtrackVolume(settings.soundtrackVolume ?? 40);
      } catch (e) {
        console.error("Erro ao carregar áudio");
      }
    }
  }, []);

  const handleSave = () => {
    const currentSettings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    const newSettings = { ...currentSettings, selectedVoice, narrationVolume, soundtrackVolume };
    localStorage.setItem('bingola_game_settings', JSON.stringify(newSettings));
    onBack();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display">
      <header className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 justify-between border-b border-gray-200 dark:border-white/5">
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-10 items-center justify-center rounded-full">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold flex-1 text-center pr-10">Controle de Áudio</h2>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="mt-4">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold px-6 pb-4 pt-2">Locutor Responsável</h3>
          <div className="flex flex-col gap-3 px-4">
            {[
              { id: 'vovo', name: 'Vovô do Bingo', desc: 'A voz clássica das quermesses' },
              { id: 'radio', name: 'Locutor de Rádio', desc: 'Energia máxima para o seu bingo' },
              { id: 'suave', name: 'Voz Suave', desc: 'Ideal para partidas relaxadas' }
            ].map((voice) => (
              <label key={voice.id} className={`group relative flex items-center gap-4 rounded-2xl p-4 transition-all cursor-pointer shadow-sm border ${selectedVoice === voice.id ? 'bg-primary/5 border-primary' : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-white/5'}`}>
                <input 
                  type="radio" 
                  name="voice" 
                  checked={selectedVoice === voice.id} 
                  onChange={() => setSelectedVoice(voice.id)}
                  className="h-6 w-6 border-2 border-slate-300 dark:border-slate-600 bg-transparent checked:border-primary checked:bg-primary transition-all focus:ring-0"
                />
                <div className="flex grow flex-col">
                  <p className="text-slate-900 dark:text-white text-base font-bold group-hover:text-primary transition-colors">{voice.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{voice.desc}</p>
                </div>
                <button className={`flex items-center justify-center size-10 rounded-full transition-colors ${selectedVoice === voice.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                  <span className="material-symbols-outlined filled text-xl" style={{fontVariationSettings: "'FILL' 1"}}>play_arrow</span>
                </button>
              </label>
            ))}
          </div>
        </div>

        <div className="my-8 h-px w-full bg-gray-200 dark:bg-white/5 px-4"></div>

        <section>
          <div className="px-6 flex items-center justify-between pb-4">
            <h3 className="text-slate-900 dark:text-white text-lg font-bold">Mixagem</h3>
            <span className="material-symbols-outlined text-primary">equalizer</span>
          </div>
          <div className="px-4 space-y-4">
            <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 border border-gray-200 dark:border-white/5 shadow-sm">
              <div className="flex justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-lg">mic</span>
                  </div>
                  <p className="font-bold text-sm">Volume do Locutor</p>
                </div>
                <p className="text-sm font-black text-primary">{narrationVolume}%</p>
              </div>
              <input 
                type="range" 
                min="0"
                max="100"
                value={narrationVolume}
                onChange={(e) => setNarrationVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none accent-primary cursor-pointer" 
              />
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 border border-gray-200 dark:border-white/5 shadow-sm">
              <div className="flex justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-500 text-lg">music_note</span>
                  </div>
                  <p className="font-bold text-sm">Trilha Sonora</p>
                </div>
                <p className="text-sm font-black text-purple-500">{soundtrackVolume}%</p>
              </div>
              <input 
                type="range" 
                min="0"
                max="100"
                value={soundtrackVolume}
                onChange={(e) => setSoundtrackVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none accent-purple-500 cursor-pointer" 
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-gray-100 dark:border-white/10">
        <button onClick={handleSave} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all">
          SALVAR ALTERAÇÕES
        </button>
      </footer>
    </div>
  );
};
