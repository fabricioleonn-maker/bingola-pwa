
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';

interface Props {
  onBack: () => void;
}

export const RulesSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const room = useRoomStore(s => s.room);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState({
    cinquina: true,
    cantos: false,
    x: false,
    cheia: true
  });

  useEffect(() => {
    if (room?.winning_patterns) {
      if (typeof room.winning_patterns === 'object') {
        setRules(prev => ({ ...prev, ...room.winning_patterns }));
      }
    } else {
      const saved = localStorage.getItem('bingola_game_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rules) setRules(parsed.rules);
      }
    }
  }, [room]);

  const handleSave = async () => {
    if (!room?.id) return;
    setLoading(true);

    // Save locally
    const current = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    localStorage.setItem('bingola_game_settings', JSON.stringify({ ...current, rules }));

    // Update Supabase
    const { error } = await supabase
      .from('rooms')
      .update({ winning_patterns: rules })
      .eq('id', room.id);

    setLoading(false);
    if (error) {
      console.error("Erro ao salvar regras:", error);
      alert("Aviso: As regras foram salvas localmente, mas houve um erro ao sincronizar com o banco de dados. Verifique se a coluna 'winning_patterns' existe na tabela 'rooms'.");
    } else {
      alert("Regras sincronizadas com sucesso!");
    }
    onBack();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="sticky top-0 z-50 flex items-center bg-background-dark/95 backdrop-blur-md p-4 justify-between border-b border-white/5">
        <button onClick={onBack} className="text-white flex size-10 items-center justify-center">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-10 italic">Prêmios da Mesa</h2>
      </header>

      <main className="flex-1 p-6 space-y-4">
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6">Selecione os padrões aceitos</p>

        {[
          { id: 'cinquina', name: 'Cinquina', desc: '5 números em linha horizontal' },
          { id: 'cantos', name: 'Cantos', desc: 'Os 4 cantos da cartela' },
          { id: 'x', name: 'Cartela em X', desc: 'Duas diagonais completas' },
          { id: 'cheia', name: 'Cartela Cheia', desc: 'Todos os números (Obrigatório)', locked: true }
        ].map(item => (
          <div
            key={item.id}
            onClick={() => !item.locked && setRules({ ...rules, [item.id]: !rules[item.id as keyof typeof rules] })}
            className={`p-6 rounded-3xl border transition-all cursor-pointer flex items-center justify-between ${rules[item.id as keyof typeof rules] ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5'}`}
          >
            <div>
              <p className="font-bold text-base">{item.name}</p>
              <p className="text-xs text-white/40">{item.desc}</p>
            </div>
            <div className={`size-6 rounded-md border-2 flex items-center justify-center transition-colors ${rules[item.id as keyof typeof rules] ? 'bg-primary border-primary' : 'border-white/20'}`}>
              {rules[item.id as keyof typeof rules] && <span className="material-symbols-outlined text-white text-sm font-black">check</span>}
            </div>
          </div>
        ))}

        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex gap-3 mt-6">
          <span className="material-symbols-outlined text-yellow-500">info</span>
          <p className="text-[10px] text-yellow-500/80 leading-relaxed font-bold uppercase tracking-widest">
            Prêmios secundários pagam 30% do pote. A cartela cheia paga 70% do pote total da rodada.
          </p>
        </div>
      </main>

      <footer className="p-6">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 italic"
        >
          {loading ? 'SINCRONIZANDO...' : 'CONFIRMAR REGRAS'}
        </button>
      </footer>
    </div>
  );
};
