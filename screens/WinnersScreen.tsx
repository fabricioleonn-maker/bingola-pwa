
import React from 'react';

interface Props {
  onBack: () => void;
}

export const WinnersScreen: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="flex flex-col min-h-screen bg-background-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, #ee7c2b 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
      
      <header className="sticky top-0 z-20 bg-background-dark/80 backdrop-blur-md p-4 pb-2 border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <h2 className="text-lg font-bold">Ganhadores da Rodada</h2>
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-10 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary blur-[60px] opacity-30 rounded-full scale-150"></div>
            <div className="relative w-36 h-36 rounded-full border-4 border-primary p-1 shadow-2xl">
              <img src="https://picsum.photos/200/200?random=50" className="w-full h-full rounded-full object-cover" />
              <div className="absolute -top-3 -right-3 bg-yellow-400 text-black p-2 rounded-full shadow-lg border-2 border-white animate-bounce">
                <span className="material-symbols-outlined text-xl block fill-1">stars</span>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg border border-white/20 whitespace-nowrap uppercase tracking-widest">
              Bingo 70%
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tight mb-1">Carlos Eduardo</h1>
          <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Ganhador Principal</div>
          
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-300 flex items-center justify-center font-black text-white shadow-lg">B</div>
             <span className="text-5xl font-black text-primary">1.500</span>
          </div>
        </div>

        <div className="w-full h-px bg-white/5 mb-8"></div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-6 px-1">Prêmios Secundários</h3>

        <div className="space-y-4">
           <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-2">Cinquina 30% (Rateio)</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-300 flex items-center justify-center font-black text-[10px]">B</div>
                    <span className="text-2xl font-black">225 <span className="text-sm font-medium text-white/20 ml-1">cada</span></span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined fill-1">group</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-4">
                   <img src="https://picsum.photos/100/100?random=51" className="w-10 h-10 rounded-full border-2 border-[#1c1a18]" />
                   <img src="https://picsum.photos/100/100?random=52" className="w-10 h-10 rounded-full border-2 border-[#1c1a18]" />
                </div>
                <p className="text-sm text-white/60">Prêmio dividido entre <span className="text-white font-bold">Ana Luiza</span> e <span className="text-white font-bold">Marcos Silva</span></p>
              </div>
           </div>

           <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
              <img src="https://picsum.photos/100/100?random=53" className="w-14 h-14 rounded-full border-2 border-primary/20" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Participante</p>
                <p className="font-bold text-lg">Ricardo G.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-300 flex items-center justify-center font-black text-[10px]">B</div>
                <span className="text-2xl font-black text-primary">50</span>
              </div>
           </div>
        </div>

        <div className="mt-12 text-center pb-20 opacity-40">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full mb-3">
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-[10px] font-bold">Câmbio: 1 BCOIN = R$ 0,10</span>
           </div>
           <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">
             Total em Jogo: 2.500 BCOINS<br/>
             Taxa da rodada: Isento (Amigos)
           </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 z-50 flex flex-col gap-4">
        <button className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-transform flex items-center justify-center gap-3">
          <span className="material-symbols-outlined fill-1">share</span> COMPARTILHAR BCOINS
        </button>
        <button className="text-white/40 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 py-2">
          <span className="material-symbols-outlined text-lg">receipt_long</span> Ver Extrato Completo
        </button>
      </div>
    </div>
  );
};
