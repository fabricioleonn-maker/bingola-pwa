
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';
import { useNotificationStore } from '../state/notificationStore';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const GameSettingsScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const room = useRoomStore(s => s.room);
  const [loading, setLoading] = useState(false);
  const [interval, setIntervalVal] = useState(10);
  const [assistMode, setAssistMode] = useState(false);

  useEffect(() => {
    // Load draw interval from room or local
    if (room?.draw_interval) {
      setIntervalVal(room.draw_interval);
    }

    // Load local settings (including assistMode)
    const saved = localStorage.getItem('bingola_game_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.interval && !room?.draw_interval) setIntervalVal(parsed.interval);
        setAssistMode(!!parsed.assistMode); // Default false
      } catch (e) {
        console.error("Erro ao carregar configurações locais");
      }
    }
  }, [room]);

  // Auto-save Interval (Debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Save locally
      const current = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
      localStorage.setItem('bingola_game_settings', JSON.stringify({
        ...current,
        interval
      }));

      // Update Supabase if host
      if (room?.id) {
        setLoading(true);
        const { error } = await supabase
          .from('rooms')
          .update({ draw_interval: interval })
          .eq('id', room.id);

        if (error) console.error("Erro ao salvar ritmo:", error);
        setLoading(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [interval, room?.id]);

  // Auto-save Assist Mode (Immediate)
  useEffect(() => {
    const current = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    localStorage.setItem('bingola_game_settings', JSON.stringify({
      ...current,
      assistMode
    }));
  }, [assistMode]);

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="sticky top-0 z-50 flex items-center bg-background-dark/95 backdrop-blur-md p-4 justify-between border-b border-white/5">
        <button onClick={onBack} className="text-white flex size-10 items-center justify-center">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-10 italic">Configurações</h2>
        {loading && <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>}
      </header>

      <main className="flex-1 p-6 space-y-8 pb-32">
        <section className="space-y-6">
          <h3 className="text-xl font-black italic">Ambiente</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onNavigate('audio_settings')}
              className="bg-white/5 border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center text-center hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-3xl mb-2">volume_up</span>
              <p className="font-bold text-xs uppercase tracking-widest">Som e Voz</p>
            </button>
            <button
              onClick={() => onNavigate('rules_settings')}
              className="bg-white/5 border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center text-center hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-3xl mb-2">military_tech</span>
              <p className="font-bold text-xs uppercase tracking-widest">Premiação</p>
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xl font-black italic">Ritmo do Sorteio</h3>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-loose">
              Define o intervalo entre cada bola sorteada.
            </p>
            <span className="bg-primary/20 text-primary text-xs font-black px-3 py-1 rounded-full">{interval}s</span>
          </div>

          <div className="bg-white/5 p-6 rounded-[3rem] border border-white/5 space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIntervalVal(Math.max(5, interval - 1))}
                className="size-12 bg-transparent rounded-2xl flex items-center justify-center text-white/50 hover:bg-white/10 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={interval}
                onChange={(e) => setIntervalVal(parseInt(e.target.value))}
                className="flex-1 h-2 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
              />
              <button
                onClick={() => setIntervalVal(Math.min(30, interval + 1))}
                className="size-12 bg-transparent rounded-2xl flex items-center justify-center text-white/50 hover:bg-white/10 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            <div className="flex justify-between px-2 text-[10px] font-black text-white/20 uppercase tracking-tighter">
              <span>Rápido (5s)</span>
              <span>Lento (30s)</span>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xl font-black italic">Personalização</h3>
          <div
            onClick={() => onNavigate('customization')}
            className="bg-white/5 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">palette</span>
              </div>
              <div>
                <p className="font-bold text-sm">Sua Cartela</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">ALTERAR CORES E TEMA</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-white/20">chevron_right</span>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xl font-black italic">Assistência de Jogo</h3>
          <div
            onClick={() => setAssistMode(!assistMode)}
            className={`flex items-center justify-between p-6 rounded-[2.5rem] border transition-all cursor-pointer ${assistMode ? 'bg-primary/10 border-primary shadow-[0_0_30px_rgba(255,61,113,0.1)]' : 'bg-white/5 border-white/5'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`size-12 rounded-2xl flex items-center justify-center ${assistMode ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-white/20'}`}>
                <span className="material-symbols-outlined">{assistMode ? 'visibility' : 'visibility_off'}</span>
              </div>
              <div>
                <p className="font-bold text-sm">Destaque de Sorteados</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Oculta visualmente os números não chamados</p>
              </div>
            </div>
            <div className={`w-14 h-8 rounded-full relative transition-colors ${assistMode ? 'bg-primary' : 'bg-white/10'}`}>
              <div className={`absolute top-1 size-6 bg-white rounded-full shadow-md transition-all ${assistMode ? 'left-7' : 'left-1'}`}></div>
            </div>
          </div>
        </section>
      </main>

      {/* Danger Zone */}
      <footer className="p-6 pb-12 bg-background-dark/95 backdrop-blur-md border-t border-white/5 space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/50 pl-2">Zona de Perigo</h3>
        <button
          onClick={async () => {
            if (window.confirm("Deseja realmente encerrar a mesa? Isso irá desconectar todos os jogadores.")) {
              if (room?.id) {
                await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id);
                // Watchdog will handle cleanup, but we can fast-track
                await supabase.from('participants').delete().eq('room_id', room.id);
                useRoomStore.getState().setRoomId(null);
                onNavigate('home');
              }
            }
          }}
          className="w-full h-14 bg-red-500/10 border border-red-500/20 text-red-500 font-black rounded-2xl uppercase text-xs hover:bg-red-500 hover:text-white transition-all"
        >
          Encerrar Mesa
        </button>
      </footer>
    </div>
  );
};
