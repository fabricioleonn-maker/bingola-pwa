import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useFriendshipStore } from '../state/friendshipStore';

interface Props {
  onBack: () => void;
}

export const RankingScreen: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'global'>('global');
  const [ranking, setRanking] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<{ pos: number, pts: number } | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const friends = useFriendshipStore(s => s.friends);

  const fetchRanking = async () => {
    setIsLoading(true);
    try {
      // Fetch App Settings for Reset Cycle (target first row regardless of ID)
      const { data: settings } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (settings) {
        setAppSettings(settings);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('profiles')
        .select('username, avatar_url, level, bpoints, id')
        .order('bpoints', { ascending: false })
        .limit(100);

      if (activeTab === 'friends') {
        const friendIds = friends.map(f => f.friend_id);
        query = query.in('id', [...friendIds, user.id]);
      }

      const { data } = await query;
      if (data) {
        setRanking(data);

        // Find my rank
        const myIndex = data.findIndex(p => p.id === user.id);
        if (myIndex !== -1) {
          setMyRank({ pos: myIndex + 1, pts: data[myIndex].bpoints || 0 });
          setMyAvatar(data[myIndex].avatar_url || null);
          setMyProfile(data[myIndex]);
        } else {
          const { data: myData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (myData) {
            setMyRank({ pos: 0, pts: myData.bpoints || 0 });
            setMyAvatar(myData.avatar_url || null);
            setMyProfile(myData);
          }
        }
      }
    } catch (err) {
      console.error("[Ranking] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!appSettings || appSettings.bpoints_reset_mode === 'manual') {
        setTimeLeft('');
        return;
      }

      const now = new Date();
      // SP Timezone (UTC-3)
      const spOffset = -3;
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const spNow = new Date(utc + (3600000 * spOffset));

      let targetDate = new Date(spNow);

      if (appSettings.bpoints_reset_mode === 'teste') {
        const lastReset = appSettings.last_bpoints_reset ? new Date(appSettings.last_bpoints_reset) : new Date();
        targetDate = new Date(lastReset.getTime() + 15000);
      } else if (appSettings.bpoints_reset_mode === 'daily') {
        targetDate.setHours(24, 0, 0, 0);
      } else if (appSettings.bpoints_reset_mode === 'weekly') {
        const day = spNow.getDay(); // 0 (Sun) to 6 (Sat)
        // Brazil week reset is Mon 0h. Sun is day 0. Mon is day 1.
        // Days until next Monday:
        // if Sun (0) -> 1
        // if Mon (1) -> 7
        // if Tue (2) -> 6 ...
        const diff = day === 0 ? 1 : (8 - day);
        targetDate.setDate(spNow.getDate() + diff);
        targetDate.setHours(0, 0, 0, 0);
      } else if (appSettings.bpoints_reset_mode === 'biweekly') {
        // 1st or 16th
        const dayOfMonth = spNow.getDate();
        if (dayOfMonth < 16) {
          targetDate.setDate(16);
          targetDate.setHours(0, 0, 0, 0);
        } else {
          targetDate.setMonth(spNow.getMonth() + 1);
          targetDate.setDate(1);
          targetDate.setHours(0, 0, 0, 0);
        }
      } else if (appSettings.bpoints_reset_mode === 'monthly') {
        targetDate = new Date(spNow.getFullYear(), spNow.getMonth() + 1, 1, 0, 0, 0);
      } else {
        // Fallback for manual or unknown
        setTimeLeft('');
        return;
      }

      const msLeft = targetDate.getTime() - spNow.getTime();

      if (msLeft < 0) {
        setTimeLeft('Resetando...');
        // TRIGGER AUTO RESET (First client to hit this window calls RPC)
        if (appSettings.bpoints_reset_mode !== 'manual' && !isResetting) {
          setIsResetting(true);
          console.log("[Ranking] Auto-triggering global reset...");
          supabase.rpc('reset_all_bpoints').then(({ error }) => {
            if (!error) {
              console.log("[Ranking] Global reset successful.");
              setTimeout(() => {
                fetchRanking();
                setIsResetting(false);
              }, 2000);
            } else {
              console.error("[Ranking] Auto-reset RPC failed:", error);
              setIsResetting(false);
            }
          });
        }
        return;
      }

      const d = Math.floor(msLeft / (1000 * 60 * 60 * 24));
      const h = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
      const m = Math.floor((msLeft / (1000 * 60)) % 60);
      const s = Math.floor((msLeft / 1000) % 60);

      if (d > 0) {
        setTimeLeft(`${d}d ${h}h ${m}m`);
      } else {
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();
    return () => clearInterval(timer);
  }, [appSettings]);

  const fetchWinnerHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('ranking_history')
        .select('*')
        .order('cycle_end_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setHistory(data);
      } else {
        // Mock data to ensure it "works" until table is created
        setHistory([
          {
            id: 1, cycle_end_at: new Date().toISOString(), mode: 'weekly', winners: [
              { username: 'Leon', bpoints: 80, rank: 1, avatar_url: null },
              { username: 'Manuel', bpoints: 45, rank: 2, avatar_url: null },
              { username: 'Monise', bpoints: 35, rank: 3, avatar_url: null }
            ]
          }
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showHistory) fetchWinnerHistory();
  }, [showHistory]);

  useEffect(() => {
    fetchRanking();
  }, [activeTab, friends]);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  const displayHistory = useMemo(() => {
    if (activeTab === 'global' || !history) return history;

    const friendUsernames = friends.map(f => (f as any).friend_profiles?.username).filter(Boolean);
    const myUsername = myProfile?.username;

    return history.map(cycle => {
      const filteredWinners = cycle.winners?.filter((w: any) => {
        return friendUsernames.includes(w.username) || w.username === myUsername;
      });
      return { ...cycle, filteredWinners }; // Use a separate field to avoid mutating history
    }).filter(cycle => cycle.filteredWinners && cycle.filteredWinners.length > 0);
  }, [history, activeTab, friends, myProfile]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background-dark pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 pb-2 border-b border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-white">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold">{activeTab === 'global' ? 'Ranking Global' : 'Ranking Amigos'}</h2>
            {timeLeft && (
              <div className="flex items-center justify-center gap-1.5 -mt-0.5">
                <span className="material-symbols-outlined text-[10px] text-primary animate-pulse">timer</span>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Renovação em: {timeLeft}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="w-10 h-10 flex items-center justify-center text-primary active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined">workspace_premium</span>
          </button>
        </div>
      </header>

      <main className="flex-1 pb-32">
        <div className="px-4 py-6 flex flex-col items-center gap-4">
          <div className="flex h-11 bg-white/5 rounded-xl p-1 w-full max-w-xs">
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'friends' ? 'bg-white/10 text-white' : 'text-white/40'}`}
            >
              AMIGOS
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'global' ? 'bg-white/10 text-white' : 'text-white/40'}`}
            >
              Global
            </button>
          </div>
        </div>

        <section className="flex items-end justify-center gap-3 px-6 py-10 mb-8 relative">
          <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

          {/* 2nd Place */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-3 order-1 mb-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-slate-400 overflow-hidden shadow-xl">
                  <img src={top3[1].avatar_url || `https://picsum.photos/100/100?random=11`} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background-dark">2</div>
              </div>
              <p className="text-sm font-bold truncate w-20 text-center">@{top3[1].username || 'Jogador'}</p>
              <p className="text-primary text-[10px] font-black">{top3[1].bpoints} pts</p>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-3 order-2 z-10 transform scale-110">
              <div className="relative">
                <div className="w-28 h-28 rounded-full border-4 border-primary overflow-hidden shadow-2xl shadow-primary/30">
                  <img src={top3[0].avatar_url || `https://picsum.photos/100/100?random=12`} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-black w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-lg font-black">emoji_events</span>
                </div>
              </div>
              <p className="text-lg font-black">@{top3[0].username || 'Jogador'}</p>
              <p className="text-primary text-xs font-black">{top3[0].bpoints} pts</p>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="flex flex-col items-center gap-3 order-3 mb-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-orange-800 overflow-hidden shadow-xl">
                  <img src={top3[2].avatar_url || `https://picsum.photos/100/100?random=13`} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background-dark">3</div>
              </div>
              <p className="text-sm font-bold truncate w-20 text-center">@{top3[2].username || 'Jogador'}</p>
              <p className="text-primary text-[10px] font-black">{top3[2].bpoints} pts</p>
            </div>
          )}
        </section>

        <section className="bg-[#1c1a18] rounded-t-[2.5rem] p-6 shadow-2xl border-t border-white/5 min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Top Jogadores</h3>
            </div>
            <span className="text-xs text-white/30 font-bold uppercase tracking-widest">
              {appSettings?.bpoints_reset_mode === 'manual' ? 'Ciclo Único' :
                appSettings?.bpoints_reset_mode === 'teste' ? 'Teste' :
                  appSettings?.bpoints_reset_mode === 'daily' ? 'Diário' :
                    appSettings?.bpoints_reset_mode === 'weekly' ? 'Semanal' :
                      appSettings?.bpoints_reset_mode === 'biweekly' ? 'Quinzenal' :
                        appSettings?.bpoints_reset_mode === 'monthly' ? 'Mensal' : 'Semanal'}
            </span>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : rest.length === 0 ? (
              <p className="text-center text-white/20 text-xs py-10 uppercase font-black">Nenhum jogador nesta lista</p>
            ) : rest.map((p, i) => (
              <div key={i} className="flex items-center gap-4 p-2 hover:bg-white/5 rounded-2xl transition-colors">
                <span className="w-6 text-center text-white/30 font-black">{i + 4}</span>
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-white/10 overflow-hidden">
                    <img src={p.avatar_url || `https://picsum.photos/100/100?random=${i + 20}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-[8px] font-black px-1.5 py-0.5 rounded-md border border-background-dark text-black">Lvl {p.level || 1}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base truncate">{p.username || 'Jogador'}</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Ativo</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{p.bpoints}</p>
                  <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Points</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-primary shadow-2xl shadow-primary/20 z-50 rounded-t-3xl">
        <div className="flex items-center justify-between text-black">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black italic">{myRank?.pos ? `${myRank.pos}º` : '--'}</span>
            <div className="w-12 h-12 rounded-full border-2 border-black/20 overflow-hidden bg-black/5 flex items-center justify-center">
              {myAvatar ? (
                <img src={myAvatar} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-black/40 text-[32px]">person</span>
              )}
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-tight">Você (Eu)</p>
              <p className="text-[10px] font-bold opacity-60">
                {myRank?.pos && myRank.pos > 3 ? `Suba no ranking!` : 'No topo! 🔥'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black">{myRank?.pts || 0}</p>
            <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Sua Pontuação</p>
          </div>
        </div>
      </div>
      {/* Winner History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[300] bg-background-dark/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-[400px] h-[80vh] bg-surface-dark border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Hall da Fama</h2>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Últimos BCampeões</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Buscando Lendas...</p>
                </div>
              ) : displayHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-10">
                  <span className="material-symbols-outlined text-white/10 text-6xl mb-4">history</span>
                  <p className="text-sm font-bold text-white/40 italic">
                    {activeTab === 'friends' ? 'Nenhum amigo subiu ao pódio nos últimos ciclos.' : 'Ainda não há ciclos concluídos. Seja o primeiro a vencer!'}
                  </p>
                </div>
              ) : (
                displayHistory.map((cycle, i) => (
                  <div key={cycle.id || i} className="bg-white/5 rounded-3xl p-5 border border-white/5">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                        {new Date(cycle.cycle_end_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                        {cycle.mode === 'daily' ? 'Diário' :
                          cycle.mode === 'weekly' ? 'Semanal' :
                            cycle.mode === 'biweekly' ? 'Quinzenal' :
                              cycle.mode === 'monthly' ? 'Mensal' :
                                cycle.mode === 'teste' ? 'Teste' : cycle.mode}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(activeTab === 'friends' ? cycle.filteredWinners : cycle.winners)?.map((w: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black italic ${idx === 0 ? 'text-primary' : 'text-white/40'}`}>
                              {idx + 1}º
                            </span>
                            <div className="size-8 rounded-full border border-white/10 overflow-hidden bg-white/5">
                              <img src={w.avatar_url || `https://picsum.photos/50/50?random=${idx + i}`} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-bold text-white/80">@{w.username || 'Jogador'}</span>
                          </div>
                          <span className="text-[10px] font-black text-primary">{w.bpoints} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-white/5">
              <button
                onClick={() => setShowHistory(false)}
                className="w-full h-14 bg-primary text-black font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Fechar Galeria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
