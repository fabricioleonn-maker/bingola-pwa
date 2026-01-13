
import React, { useEffect, useState, useRef } from 'react';
import { AppScreen } from '../types';

interface Props {
  onBack: () => void;
  onNavigate: (screen: AppScreen) => void;
}

export const ParticipantLobby: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [pin, setPin] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('bingola_current_user') || '{}');
    
    // Watchdog: Verifica autorização baseada no PIN que o usuário digitou
    const watchdog = setInterval(() => {
       if (!pin || pin.length < 4) return;

       const tableKey = `bingola_table_${pin}`;
       const table = JSON.parse(localStorage.getItem(tableKey) || '[]');
       const isAuthorized = table.some((p: any) => p.id === user.id);

       if (isAuthorized) {
          clearInterval(watchdog);
          onNavigate('game');
       }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [pin]);

  const handleJoin = () => {
    setError('');
    const active = JSON.parse(localStorage.getItem('bingola_active_room') || '{}');
    // Em um cenário real, isso viria de um backend. No mock, verificamos a sala ativa no localStorage.
    if (active.code === pin) {
      const user = JSON.parse(localStorage.getItem('bingola_current_user') || '{}');
      const reqs = JSON.parse(localStorage.getItem(`bingola_join_requests_${pin}`) || '[]');
      if (!reqs.find((r: any) => r.id === user.id)) {
        reqs.push({ 
          id: user.id || Date.now().toString(), 
          name: user.name || 'Visitante', 
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100' 
        });
        localStorage.setItem(`bingola_join_requests_${pin}`, JSON.stringify(reqs));
      }
      setRoom(active);
      setIsJoined(true);
    } else {
      setError('Mesa não encontrada. Verifique o código.');
    }
  };

  const handleBoxClick = () => {
    inputRef.current?.focus();
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col min-h-screen bg-background-dark font-display text-white p-6 justify-center">
        <div className="text-center mb-10">
          <div className="size-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-6 border border-primary/30">
            <span className="material-symbols-outlined text-4xl">vpn_key</span>
          </div>
          <h2 className="text-3xl font-black italic mb-2">Entrar na Mesa</h2>
          <p className="text-white/40 text-sm">Insira o código de 4 dígitos do anfitrião.</p>
        </div>
        
        <div className="space-y-8 max-w-xs mx-auto w-full relative">
          <div className="flex justify-between gap-3 cursor-pointer" onClick={handleBoxClick}>
             {[0,1,2,3].map(i => (
               <div key={i} className={`flex-1 h-20 bg-white/5 border-2 rounded-2xl flex items-center justify-center text-4xl font-black transition-all ${pin.length === i ? 'border-primary shadow-[0_0_20px_rgba(255,61,113,0.3)] bg-primary/5' : 'border-white/10'}`}>
                 {pin[i] || ""}
                 {!pin[i] && <div className="w-2 h-2 bg-white/20 rounded-full"></div>}
               </div>
             ))}
          </div>
          
          <input 
            ref={inputRef}
            type="tel" 
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            className="absolute top-0 left-0 w-full h-20 opacity-0 cursor-default"
            style={{ fontSize: '16px' }}
          />
          
          <div className="grid grid-cols-1 gap-4">
             {error && <p className="text-red-500 text-[10px] font-black uppercase text-center animate-bounce">{error}</p>}
             <button onClick={handleJoin} disabled={pin.length < 4} className={`w-full h-16 font-black rounded-2xl shadow-xl transition-all ${pin.length === 4 ? 'bg-primary text-white scale-100 shadow-primary/30' : 'bg-white/5 text-white/20 scale-95 cursor-not-allowed'}`}>PEDIR ENTRADA</button>
             <button onClick={onBack} className="w-full py-4 text-white/20 font-bold text-xs uppercase tracking-widest">Voltar ao Menu</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="p-4 border-b border-white/5 bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary"><span className="material-symbols-outlined">casino</span></div>
          <div>
            <h1 className="text-sm font-bold">{room?.name}</h1>
            <p className="text-[10px] font-black text-white/40 uppercase">Aguardando Autorização...</p>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center px-6 pt-32 text-center">
        <div className="size-24 rounded-full border-4 border-primary/20 flex items-center justify-center mb-8 bg-white/5 animate-pulse shadow-[0_0_30px_rgba(255,61,113,0.2)]">
          <span className="material-symbols-outlined text-4xl text-primary">hourglass_empty</span>
        </div>
        <h2 className="text-3xl font-black mb-2 italic">Na fila de espera!</h2>
        <p className="text-sm text-white/40 mb-12">O anfitrião recebeu seu pedido para a mesa <span className="text-primary font-bold">{pin}</span>. Você entrará automaticamente assim que for aceito.</p>
        <button onClick={onBack} className="bg-white/5 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10">Voltar ao Menu</button>
      </main>
    </div>
  );
};
