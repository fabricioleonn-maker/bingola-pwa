import React, { useEffect, useState } from 'react';
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
  const friends = useFriendshipStore(s => s.friends);

  const fetchRanking = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('profiles')
        .select('username, avatar_url, level, bpoints, id')
        .order('bpoints', { ascending: false })
        .limit(100);

      if (activeTab === 'friends') {
        const friendIds = friends.map(f => f.friend_id);
        // Include self in friends ranking
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
        } else {
          // If not in top 100, fetch my specific rank (approximate or just show points)
          const { data: myData } = await supabase.from('profiles').select('bpoints, avatar_url').eq('id', user.id).single();
          setMyRank({ pos: 0, pts: myData?.bpoints || 0 });
          setMyAvatar(myData?.avatar_url || null);
        }
      }
    } catch (err) {
      console.error("[Ranking] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, [activeTab, friends]);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background-dark pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 bg-background-dark/95 backdrop-blur-md p-4 pb-2 border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <h2 className="text-lg font-bold">{activeTab === 'global' ? 'Ranking Global' : 'Ranking Amigos'}</h2>
        <button className="w-10 h-10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">workspace_premium</span>
        </button>
      </header>

      <main className="flex-1 pb-32">
        <div className="px-4 py-6 flex justify-center">
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
            <h3 className="text-xl font-bold">Top Jogadores</h3>
            <span className="text-xs text-white/30 font-bold uppercase tracking-widest">Semanal</span>
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
    </div>
  );
};
