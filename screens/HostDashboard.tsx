
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../types';
import { useRoomStore } from '../state/roomStore';
import MusicPlayerPanel from '../components/MusicPlayerPanel';

interface Props {
  onBack: () => void;
  onPublish: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const HostDashboard: React.FC<Props> = ({ onBack, onPublish, onNavigate }) => {
  const [roomName, setRoomName] = useState('BINGOLA DE DOMINGO');
  const [playerLimit, setPlayerLimit] = useState<string>('10');
  const [rounds, setRounds] = useState<string>('1');
  const [bpoints, setBpoints] = useState<string>('500');
  const [prizeDistribution, setPrizeDistribution] = useState<'total' | 'per_round'>('per_round');
  const [isPublishing, setIsPublishing] = useState(false);
  const setRoomId = useRoomStore((s) => s.setRoomId);
  const [userBalance, setUserBalance] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfileId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('bcoins')
          .eq('id', user.id)
          .single();
        if (profile) setUserBalance(profile.bcoins || 0);
      }
    };
    fetchBalance();

    // Recover draft settings from localStorage if available
    const draft = localStorage.getItem('bingola_host_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.roomName) setRoomName(parsed.roomName);
        if (parsed.playerLimit) setPlayerLimit(parsed.playerLimit.toString());
        if (parsed.rounds) setRounds(parsed.rounds.toString());
        if (parsed.bpoints) setBpoints(parsed.bpoints.toString());
      } catch (e) { console.error(e); }
    }
  }, []);

  // Save draft periodically
  useEffect(() => {
    const draft = { roomName, playerLimit, rounds, bpoints };
    localStorage.setItem('bingola_host_draft', JSON.stringify(draft));
  }, [roomName, playerLimit, rounds, bpoints]);

  const pLimitNum = parseInt(playerLimit) || 0;
  const roundsNum = parseInt(rounds) || 0;
  const bpointsNum = parseInt(bpoints) || 0;

  const costPerSlot = Math.ceil(roundsNum / 5);
  const totalCost = costPerSlot * pLimitNum;

  const canPublish = roundsNum >= 1 && pLimitNum >= 1 && roomName.length > 3;

  const handlePublish = async () => {
    if (isPublishing || !profileId) return;

    if (!roomName || roomName.length < 3) {
      alert("O nome da mesa deve ter pelo menos 3 caracteres.");
      return;
    }
    if (pLimitNum < 1) {
      alert("A mesa precisa de pelo menos 1 vaga.");
      return;
    }
    if (roundsNum < 1) {
      alert("A mesa precisa de pelo menos 1 rodada.");
      return;
    }

    if (pLimitNum === 1) {
      if (!window.confirm("Atenção: Você está abrindo uma mesa para apenas 1 jogador (você mesmo). Deseja continuar?")) {
        return;
      }
    }

    if (userBalance < totalCost) {
      alert(`Saldo insuficiente! Esta mesa custa ${totalCost} BCOINS.`);
      onNavigate('store');
      return;
    }

    setIsPublishing(true);

    try {
      // 0. Aggressive Cleanup BEFORE creating new room (User suggestion)
      setRoomId(null);
      localStorage.removeItem('bingola_active_room');
      localStorage.removeItem('bingola_active_room_id');
      localStorage.removeItem('bingola_game_running');
      localStorage.removeItem('bingola_is_paused');
      localStorage.removeItem('bingola_drawn_numbers');
      localStorage.removeItem('bingola_player_marked');
      localStorage.removeItem('bingola_player_grid');
      localStorage.removeItem('bingola_claimed_prizes');
      localStorage.removeItem('bingola_last_winner');

      // 1. Deduct from Supabase profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ bcoins: userBalance - totalCost })
        .eq('id', profileId);

      if (updateError) {
        throw new Error('Erro ao processar pagamento no servidor.');
      }

      const shortCode = Math.floor(1000 + Math.random() * 9000).toString();

      // Calculate effective per-round value
      let effectiveBpoints = bpointsNum;
      if (prizeDistribution === 'total') {
        effectiveBpoints = Math.floor(bpointsNum / Math.max(1, roundsNum));
      }

      // 2. Create room in Supabase
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          host_id: profileId,
          name: roomName,
          code: shortCode,
          player_limit: pLimitNum,
          rounds: roundsNum,
          current_round: 1,
          prize_pool: effectiveBpoints,
          status: 'lobby'
        })
        .select()
        .single();

      if (roomError) {
        console.error('Room error:', roomError);
        throw new Error('Erro ao criar sala no Supabase.');
      }

      const roomSettings = {
        id: roomData.id,
        host_id: profileId,
        name: roomName,
        limit: pLimitNum,
        totalRounds: roundsNum,
        currentRound: 1,
        code: shortCode,
        prize: effectiveBpoints,
        prizeDistribution,
        bpoints: effectiveBpoints,
        prize_pool: effectiveBpoints,
        cost: totalCost,
        isHost: true
      };

      localStorage.setItem('bingola_active_room', JSON.stringify(roomSettings));
      // IMPORTANT: make the room id the single source of truth.
      // Without this, the host lobby won't start subscription/polling and
      // join requests only appear after a manual navigation.
      setRoomId(roomData.id);
      localStorage.setItem('bingola_game_running', 'false');
      localStorage.setItem('bingola_is_paused', 'false');

      // ✅ Garante configurações padrão da mesa ao criar (Ritmo 12s por padrão)
      const defaultSettings = {
        interval: 12,
        rules: { cheia: true, cinquina: true, cantos: true, x: true }
      };
      localStorage.setItem('bingola_game_settings', JSON.stringify(defaultSettings));
      localStorage.removeItem('bingola_drawn_numbers');
      localStorage.removeItem('bingola_player_marked');
      localStorage.removeItem('bingola_player_grid');
      localStorage.removeItem('bingola_claimed_prizes');
      localStorage.removeItem('bingola_last_winner');

      // Clear draft
      localStorage.removeItem('bingola_host_draft');

      setTimeout(() => onPublish(), 800);
    } catch (e: any) {
      alert(e.message || 'Erro ao publicar mesa.');
      setIsPublishing(false);
    }
  };

  const adjustValue = (setter: (v: string) => void, current: string, delta: number, minVale: number = 0) => {
    const val = (parseInt(current) || 0) + delta;
    setter(Math.max(minVale, val).toString());
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background-dark/80 backdrop-blur-md z-30">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold italic">Configurar Mesa</h2>
        <div className="bg-white/10 px-3 py-1 rounded-full border border-primary/30 flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-sm">payments</span>
          <span className="text-xs font-black">{userBalance}</span>
        </div>
      </header>

      <main id="host-config-section" className="flex-1 p-6 space-y-8 pb-32 overflow-y-auto">
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/60 text-center">Nome da Mesa</h3>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value.toUpperCase())}
            className="w-full h-16 bg-white/[0.03] px-6 rounded-2xl text-base font-bold outline-none border border-white/5 focus:border-primary/30 transition-all text-center"
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/60 text-center">Vagas e Rodadas</h3>
          <div className="grid grid-cols-2 gap-6">
            <div id="config-slots-container" className="space-y-3">
              <label className="text-[9px] font-bold text-white/30 tracking-[0.2em] text-center block uppercase">Vagas na Mesa</label>
              <div className="flex items-center justify-between bg-white/[0.03] rounded-3xl p-1">
                <button onClick={() => adjustValue(setPlayerLimit, playerLimit, -1, 1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                  <span className="material-symbols-outlined text-white/30 text-xl">remove</span>
                </button>
                <input
                  type="tel"
                  pattern="[0-9]*"
                  value={playerLimit}
                  onChange={(e) => setPlayerLimit(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-12 text-center font-black text-xl bg-transparent outline-none p-0 border-none appearance-none"
                />
                <button onClick={() => adjustValue(setPlayerLimit, playerLimit, 1, 1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                  <span className="material-symbols-outlined text-white/30 text-xl">add</span>
                </button>
              </div>
            </div>
            <div id="config-rounds-container" className="space-y-3">
              <label className="text-[9px] font-bold text-white/30 tracking-[0.2em] text-center block uppercase">Total de Rodadas</label>
              <div className="flex items-center justify-between bg-white/[0.03] rounded-3xl p-1">
                <button onClick={() => adjustValue(setRounds, rounds, -1, 1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                  <span className="material-symbols-outlined text-white/30 text-xl">remove</span>
                </button>
                <input
                  type="tel"
                  pattern="[0-9]*"
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-12 text-center font-black text-xl bg-transparent outline-none p-0 border-none appearance-none"
                />
                <button onClick={() => adjustValue(setRounds, rounds, 1, 1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                  <span className="material-symbols-outlined text-white/30 text-xl">add</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="config-bpoints-container" className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-green-500/60 text-center">Premiação BPOINTS (Dinheiro Fictício)</h3>
          <div className="bg-white/[0.03] rounded-[2.5rem] border border-white/5 p-6 flex items-center justify-between group focus-within:border-green-500/20 transition-all">
            <button onClick={() => adjustValue(setBpoints, bpoints, -50, 0)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-white/20 text-2xl">remove</span>
            </button>
            <div className="flex-1 text-center">
              <div className="text-[9px] font-black text-green-500/30 uppercase tracking-widest mb-1">
                {prizeDistribution === 'total' ? 'VALOR TOTAL' : 'POR RODADA'}
              </div>
              <div className="flex items-baseline justify-center">
                <textarea
                  value={bpoints + ',00'}
                  onChange={(e) => {
                    const val = e.target.value;
                    let clean = '';

                    // 1. If user cleared everything
                    if (val === '') {
                      clean = '';
                    }
                    // 2. If suffix is intact, just parse the prefix
                    else if (val.endsWith(',00')) {
                      clean = val.slice(0, -3).replace(/[^0-9]/g, '');
                    }
                    // 3. Suffix damaged or removed
                    else {
                      // Check if comma was deleted (merging zeros)
                      // If we have no comma, effectively we have [digits]
                      if (!val.includes(',')) {
                        const digits = val.replace(/[^0-9]/g, '');
                        // If it looks like old value + 00, reject it (comma deletion)
                        if (digits === bpoints + '00') {
                          e.target.value = bpoints + ',00'; // Revert view
                          return; // Reject change
                        }
                        // Otherwise assume full replacement (e.g. select all -> type 8)
                        clean = digits;
                      } else {
                        // Comma exists but not at end (e.g. "5,0"). Reject partial suffix edit.
                        e.target.value = bpoints + ',00';
                        return;
                      }
                    }

                    // Update state
                    setBpoints(clean);

                    // Auto-height
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className={`min-w-[80px] w-full max-w-[200px] font-black text-center bg-transparent outline-none p-0 border-none appearance-none resize-none overflow-hidden whitespace-pre-wrap break-all ${bpoints.length > 10 ? 'text-2xl' : bpoints.length > 7 ? 'text-3xl' : 'text-4xl'}`}
                  rows={1}
                />
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setPrizeDistribution(prev => prev === 'total' ? 'per_round' : 'total')}
                  className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[10px] text-primary">swap_horiz</span>
                  <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                    {prizeDistribution === 'total' ? 'Fracionar Total' : 'Valor Fixo/Rodada'}
                  </span>
                </button>
              </div>

              <div className="text-[10px] font-bold text-white/20 mt-4 tracking-[0.2em] uppercase">
                {prizeDistribution === 'total' ?
                  `~ ${(bpointsNum / roundsNum).toFixed(2)} pts por rodada` :
                  `Total: ${(bpointsNum * roundsNum).toFixed(2)} pts`
                }
              </div>
            </div>
            <button onClick={() => adjustValue(setBpoints, bpoints, 50, 0)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-white/20 text-2xl">add</span>
            </button>
          </div>
        </section>


        <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 flex flex-col items-center gap-1 text-center">
          <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Custo de Abertura</p>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            <span className="text-4xl font-black text-primary">{totalCost} BCOINS</span>
          </div>
          <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest mt-4 italic leading-relaxed">
            Regra: 1 BCOIN por vaga a cada 5 rodadas.<br />
            (1-5: 1 pts/vaga | 6-10: 2 pts/vaga | 11-15: 3 pts/vaga)
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 border-t border-white/5 backdrop-blur-md">
        <button
          id="open-mesa-btn"
          onClick={handlePublish}
          disabled={isPublishing}
          className="w-full h-20 bg-primary text-white font-black text-xl rounded-3xl shadow-2xl transition-all active:scale-95"
        >
          {isPublishing ? 'PROCESSANDO...' : 'PAGAR E ABRIR MESA'}
        </button>
      </footer>
    </div>
  );
};
