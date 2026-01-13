
import React from 'react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-end pb-32 relative overflow-hidden">
      {/* Estrelas */}
      <div className="absolute inset-0 z-0">
        <div className="star w-[1px] h-[1px] top-[5%] left-[12%] opacity-90"></div>
        <div className="star w-[2px] h-[2px] top-[8%] left-[45%] opacity-100"></div>
        <div className="star w-[1px] h-[1px] top-[15%] left-[85%] opacity-70"></div>
        <div className="star w-[1px] h-[1px] top-[18%] left-[25%] opacity-80"></div>
        <div className="star w-[2px] h-[2px] top-[12%] left-[65%] opacity-90"></div>
        <div className="star w-[1.5px] h-[1.5px] top-[22%] left-[40%] opacity-100"></div>
      </div>

      {/* Bolas de Bingo caindo */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="bingo-ball w-12 h-12 left-[10%] -top-12 animate-fall-slow opacity-60" style={{ animationDelay: '0s' }}>23</div>
        <div className="bingo-ball w-10 h-10 left-[85%] -top-12 animate-fall-slow opacity-50" style={{ animationDelay: '1.5s' }}>07</div>
        <div className="bingo-ball w-14 h-14 left-[45%] -top-12 animate-fall-slow opacity-40" style={{ animationDelay: '3s' }}>41</div>
        <div className="bingo-ball w-16 h-16 left-[25%] -top-16 animate-fall-medium opacity-80 z-10" style={{ animationDelay: '0.5s' }}>15</div>
        <div className="bingo-ball w-20 h-20 left-[60%] -top-20 animate-fall-medium opacity-75 z-10" style={{ animationDelay: '2s' }}>66</div>
        <div className="bingo-ball w-24 h-24 left-[35%] -top-24 animate-fall-fast blur-[1px] z-20" style={{ animationDelay: '1s' }}>B</div>
        <div className="bingo-ball w-20 h-20 left-[15%] -top-20 animate-fall-fast blur-[1px] z-20" style={{ animationDelay: '4s' }}>99</div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-900/10 blur-[180px] rounded-full"></div>

      <div className="relative z-30 flex flex-col items-center w-full mb-12">
        <div className="mb-8 animate-float-slow">
          <div className="w-32 h-32 rounded-[40px] overflow-hidden border-4 border-white/10 shadow-2xl shadow-pink-500/10">
            <img src="/pwa-512x512.png" alt="Bingola Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="text-center space-y-2 mb-16">
          <h1 className="text-8xl font-black gradient-text tracking-tighter drop-shadow-2xl leading-tight py-2">
            Bingola
          </h1>
          <p className="text-white/70 text-base font-medium tracking-[0.2em] uppercase">
            A sua sorte começa aqui
          </p>
        </div>

        <div className="w-full px-12 flex flex-col items-center space-y-4">
          <div className="w-full max-w-[240px] h-[4px] bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2/3 bg-gradient-to-r from-[#FF2E95] to-[#9D4EDD] loading-glow rounded-full"></div>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-bold animate-pulse">Iniciando jornada</p>
        </div>
      </div>

      <div className="absolute bottom-12 opacity-40 z-30">
        <span className="material-symbols-outlined text-white text-2xl">auto_awesome</span>
      </div>
    </div>
  );
};
