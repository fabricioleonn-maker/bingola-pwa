
import React from 'react';

interface Props {
  onBack: () => void;
}

export const RankingScreen: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<'friends' | 'global'>('global');

  const players = [
    { rank: 4, name: 'Ana Beatriz', level: 38, pts: '65.200', online: false },
    { rank: 5, name: 'Ricardo Lima', level: 41, pts: '58.900', online: true },
    { rank: 6, name: 'Juliana Costa', level: 32, pts: '42.300', online: true },
    { rank: 7, name: 'Marcos Paulo', level: 29, pts: '35.600', online: true }
  ];

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
              Amigos
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
          <div className="flex flex-col items-center gap-3 order-1 mb-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-slate-400 overflow-hidden shadow-xl">
                <img src="https://picsum.photos/100/100?random=11" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background-dark">2</div>
            </div>
            <p className="text-sm font-bold truncate w-20 text-center">@luckyfam</p>
            <p className="text-primary text-[10px] font-black">+120 pts</p>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center gap-3 order-2 z-10 transform scale-110">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-primary overflow-hidden shadow-2xl shadow-primary/30">
                <img src="https://picsum.photos/100/100?random=12" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-black w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-lg font-black">emoji_events</span>
              </div>
            </div>
            <p className="text-lg font-black">@bingoking</p>
            <p className="text-primary text-xs font-black">+150 pts</p>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center gap-3 order-3 mb-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-orange-800 overflow-hidden shadow-xl">
                <img src="https://picsum.photos/100/100?random=13" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background-dark">3</div>
            </div>
            <p className="text-sm font-bold truncate w-20 text-center">@daisy12</p>
            <p className="text-primary text-[10px] font-black">+90 pts</p>
          </div>
        </section>

        <section className="bg-[#1c1a18] rounded-t-[2.5rem] p-6 shadow-2xl border-t border-white/5 min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Top Jogadores</h3>
            <span className="text-xs text-white/30 font-bold uppercase tracking-widest">Semanal</span>
          </div>

          <div className="space-y-4">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-4 p-2 hover:bg-white/5 rounded-2xl transition-colors">
                <span className="w-6 text-center text-white/30 font-black">{p.rank}</span>
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-white/10 overflow-hidden">
                    <img src={`https://picsum.photos/100/100?random=${i + 20}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-[8px] font-black px-1.5 py-0.5 rounded-md border border-background-dark">Lvl {p.level}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base truncate">{p.name}</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${p.online ? 'bg-green-500' : 'bg-white/20'}`}></div>
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{p.online ? 'Online' : 'Ausente'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{p.pts}</p>
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
            <span className="text-2xl font-black italic">42º</span>
            <div className="w-12 h-12 rounded-full border-2 border-black/20 overflow-hidden">
              <img src="https://picsum.photos/100/100" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-tight">Você (Eu)</p>
              <p className="text-[10px] font-bold opacity-60">Faltam 120pts para o Top 40</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black">4.210</p>
            <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Sua Pontuação</p>
          </div>
        </div>
      </div>
    </div>
  );
};
