
import React from 'react';

interface Props {
  onBack: () => void;
}

export const MessageCenter: React.FC<Props> = ({ onBack }) => {
  const notifications = [
    { 
      type: 'bonus', 
      title: 'Bônus de Indicação', 
      desc: 'Você recebeu 50 BCOINS! Seu amigo Marcos entrou no Bingola.', 
      time: 'Agora', 
      icon: 'payments',
      new: true
    },
    { 
      type: 'ranking', 
      title: 'Atualização de Ranking', 
      desc: 'Parabéns! Você subiu para o Top 10 no Ranking Semanal.', 
      time: '5 min', 
      icon: 'emoji_events',
      new: false
    },
    { 
      type: 'friend', 
      title: 'Novo Amigo na Sala', 
      desc: 'Ana Paula acabou de entrar na sua sala de Bingo.', 
      time: '20 min', 
      avatar: 'https://picsum.photos/100/100?random=10',
      new: false
    },
    { 
      type: 'system', 
      title: 'Alerta de Sistema', 
      desc: 'Manutenção programada para amanhã às 02:00 BRT.', 
      time: '1d', 
      icon: 'settings',
      new: false,
      dimmed: true
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <header className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button onClick={onBack} className="w-12 h-12 flex items-center justify-start text-white">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <h2 className="text-lg font-bold flex-1 text-center">Central de Mensagens</h2>
          <button className="w-12 flex items-center justify-end text-primary">
            <span className="material-symbols-outlined">done_all</span>
          </button>
        </div>
        <div className="flex px-4">
          <button className="flex-1 pb-4 pt-2 border-b-2 border-primary text-primary font-bold text-sm">Notificações</button>
          <button className="flex-1 pb-4 pt-2 border-b-2 border-transparent text-white/40 font-bold text-sm">Mensagens</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Hoje</p>
        </div>

        <div className="flex flex-col">
          {notifications.map((n, i) => (
            <div 
              key={i} 
              className={`flex items-start gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${n.dimmed ? 'opacity-50' : ''}`}
            >
              <div className="flex-shrink-0">
                {n.avatar ? (
                  <img src={n.avatar} className="w-12 h-12 rounded-full border border-primary/40" />
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${n.type === 'bonus' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-dark text-primary'}`}>
                    <span className="material-symbols-outlined">{n.icon}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base leading-tight">{n.title}</h4>
                  {n.new && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                </div>
                <p className="text-sm text-white/60 leading-snug">{n.desc}</p>
              </div>
              <span className="text-[10px] font-bold text-white/20 whitespace-nowrap">{n.time}</span>
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-6 right-6">
        <button className="bg-primary text-white w-14 h-14 rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-3xl">chat</span>
        </button>
      </div>
    </div>
  );
};
