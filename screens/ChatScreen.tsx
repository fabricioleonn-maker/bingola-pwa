
import React, { useState } from 'react';

interface Props {
  onBack: () => void;
}

export const ChatScreen: React.FC<Props> = ({ onBack }) => {
  const [msg, setMsg] = useState('');

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#181511] dark:text-[#f8f7f5] min-h-screen flex flex-col font-display">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button onClick={onBack} className="text-[#181511] dark:text-white flex size-10 items-center justify-center">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-lg font-bold">Chat do Bingo</h2>
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="size-2 bg-green-500 rounded-full animate-pulse"></span> 124 Jogando
            </span>
          </div>
          <button className="w-10 h-10 flex items-center justify-end">
            <span className="material-symbols-outlined">info</span>
          </button>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex min-w-[120px] flex-col gap-1 rounded-xl p-3 bg-primary text-white shadow-lg shadow-primary/20">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Atual</p>
            <p className="text-3xl font-black leading-none">B-12</p>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7960] dark:text-gray-400">Anteriores</p>
            <div className="flex gap-2">
              <span className="size-8 rounded-full bg-[#f5f3f0] dark:bg-gray-800 flex items-center justify-center text-sm font-bold">G48</span>
              <span className="size-8 rounded-full bg-[#f5f3f0] dark:bg-gray-800 flex items-center justify-center text-sm font-bold">I22</span>
              <span className="size-8 rounded-full bg-[#f5f3f0] dark:bg-gray-800 flex items-center justify-center text-sm font-bold opacity-60">O61</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 w-full">
        <div className="flex justify-center">
          <div className="bg-gray-100 dark:bg-gray-800/50 px-4 py-1 rounded-full text-[11px] font-medium text-gray-400 uppercase tracking-widest">A partida começou!</div>
        </div>

        <div className="flex items-end gap-3">
          <img src="https://picsum.photos/100/100?random=1" className="size-10 rounded-full border-2 border-white dark:border-gray-700" />
          <div className="flex flex-1 flex-col gap-1 items-start">
            <p className="text-primary text-[11px] font-bold ml-1">Maria Oliveira</p>
            <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-3 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-base font-normal text-gray-200">Vem o 22! Só falta ele pra fechar a coluna!</p>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3 justify-end">
          <div className="flex flex-1 flex-col gap-1 items-end">
            <p className="text-primary text-[11px] font-bold mr-1">Você</p>
            <div className="max-w-[85%] rounded-2xl rounded-br-none px-4 py-3 bg-primary shadow-lg shadow-primary/20">
              <p className="text-base font-bold text-white">BINGOOO! Eu não acredito!</p>
            </div>
          </div>
          <img src="https://picsum.photos/100/100?random=2" className="size-10 rounded-full border-2 border-primary" />
        </div>
      </main>

      <footer className="bg-white dark:bg-background-dark border-t border-gray-100 dark:border-gray-800 p-4 pb-8">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex justify-between px-2">
            {['🔥', '👏', '😂', '😭', '🥳'].map((emoji) => (
              <button key={emoji} className="size-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl active:scale-95 transition-all">{emoji}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-1">
            <input 
              value={msg} 
              onChange={(e) => setMsg(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 text-white placeholder:text-gray-400" 
              placeholder="Envie uma mensagem..." 
            />
            <button className="bg-primary text-white size-10 rounded-full flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
