
import React, { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

type TabType = 'cores' | 'fontes' | 'icones';

export const CustomizationScreen: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('cores');
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([21, 25]);
  
  const [cardColor, setCardColor] = useState('#ff3d71');
  const [numberStyle, setNumberStyle] = useState('classic');
  const [stampIcon, setStampIcon] = useState('stars');
  const [opacity, setOpacity] = useState(80);

  const colors = [
    { name: 'Pink', hex: '#ff3d71' },
    { name: 'Laranja', hex: '#ff843d' },
    { name: 'Roxo', hex: '#a855f7' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Verde', hex: '#22c55e' }
  ];

  const themes = [
    { id: 'classic', name: 'Original', desc: 'Design moderno e limpo', img: 'https://images.unsplash.com/photo-1483736762161-1d107f3c78e1?q=80&w=300&auto=format&fit=crop' },
    { id: 'retro', name: 'Retrô Cassino', desc: 'O clássico inesquecível', img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop' },
    { id: 'neon', name: 'Vegas Neon', desc: 'Alta voltagem e brilho', img: 'https://images.unsplash.com/photo-1595113316349-9fa4ee24f884?q=80&w=300&auto=format&fit=crop' },
    { id: 'minimal', name: 'Minimalista', desc: 'Foco nos números', img: 'https://images.unsplash.com/photo-1518133839073-42716b066fe8?q=80&w=300&auto=format&fit=crop' }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('bingola_card_custom');
    if (saved) {
      const data = JSON.parse(saved);
      setCardColor(data.cardColor || '#ff3d71');
      setNumberStyle(data.numberStyle || 'classic');
      setStampIcon(data.stampIcon || 'stars');
      setOpacity(data.opacity || 80);
      setSelectedTheme(data.selectedTheme || 'classic');
    }
  }, []);

  const handleSave = () => {
    const config = { cardColor, numberStyle, stampIcon, opacity, selectedTheme };
    localStorage.setItem('bingola_card_custom', JSON.stringify(config));
    onBack();
  };

  const getPreviewStyles = () => {
    switch (selectedTheme) {
      case 'retro': return { cardBg: 'bg-[#f0e6d2]', cellBg: 'bg-white', textColor: 'text-[#4a3a2a]', border: 'border-[#d6ccb8]' };
      case 'neon': return { cardBg: 'bg-[#0a0a0a]', cellBg: 'bg-[#1a1a1a]', textColor: 'text-white/90', border: 'border-primary/20' };
      case 'minimal': return { cardBg: 'bg-white', cellBg: 'bg-gray-50', textColor: 'text-zinc-800', border: 'border-gray-100' };
      default: return { cardBg: 'bg-surface-dark', cellBg: 'bg-white/5', textColor: 'text-white', border: 'border-white/10' };
    }
  };

  const preview = getPreviewStyles();

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <header className="sticky top-0 z-50 flex items-center bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 justify-between">
        <button onClick={onBack} className="text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-lg font-bold">Personalização</h2>
        <button onClick={handleSave} className="text-primary font-black text-sm uppercase italic">Salvar</button>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        <div className="pt-6">
          <div className="flex overflow-x-auto no-scrollbar gap-4 px-6 pb-6">
            {themes.map((t) => (
              <button 
                key={t.id}
                onClick={() => setSelectedTheme(t.id)}
                className={`flex-none w-56 relative rounded-3xl overflow-hidden aspect-[3/4] border-4 transition-all ${selectedTheme === t.id ? 'border-primary scale-100 opacity-100 shadow-xl' : 'border-white/5 scale-95 opacity-50'}`}
              >
                <img src={t.img} className="absolute inset-0 w-full h-full object-cover" alt={t.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-5 text-left">
                   <h4 className="font-black text-base italic">{t.name}</h4>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col items-center">
          <div className={`w-full max-w-[300px] aspect-[4/5] rounded-[3rem] overflow-hidden flex flex-col p-4 border-8 shadow-2xl ${preview.cardBg} ${preview.border}`}>
             <div className="h-[12%] rounded-t-2xl flex items-center justify-around" style={{ backgroundColor: cardColor }}>
               {['B','I','N','G','O'].map(l => <span key={l} className="text-white font-black text-xl">{l}</span>)}
             </div>
             <div className="flex-1 grid grid-cols-5 gap-1.5 mt-2">
                {[4, 21, 35, 52, 68, 7, 0, 44, 49, 63, 12, 19, 0, 58, 71, 3, 25, 33, 55, 66, 15, 22, 40, 50, 75].map((cell, i) => (
                  <div key={i} className={`aspect-square flex items-center justify-center rounded-xl font-black text-base relative border transition-all ${cell === 0 ? 'bg-primary/20 border-primary/40' : `${preview.cellBg} ${preview.border} ${preview.textColor}`}`}>
                    {cell === 0 ? (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[6px] text-primary font-black uppercase">BINGOLA</span>
                        <span className="text-[7px] text-primary font-black uppercase">LIVRE</span>
                      </div>
                    ) : (
                      <span className={`${numberStyle === 'modern' ? 'font-mono' : numberStyle === 'serif' ? 'font-serif' : 'font-bold'}`}>{cell}</span>
                    )}
                    {markedNumbers.includes(cell) && cell !== 0 && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: opacity / 100 }}>
                        <span className="material-symbols-outlined text-3xl" style={{ color: cardColor }}>{stampIcon}</span>
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/5">
          <div className="flex px-6">
            {(['cores', 'fontes', 'icones'] as TabType[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-5 font-black text-[10px] uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-white/40'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'cores' && (
              <div className="flex justify-center gap-6 py-4">
                {colors.map((c) => (
                  <button 
                    key={c.hex}
                    onClick={() => setCardColor(c.hex)}
                    className={`shrink-0 size-12 rounded-full border-4 transition-all ${cardColor === c.hex ? 'border-white scale-125 shadow-xl shadow-white/20' : 'border-transparent opacity-60'}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            )}
            {activeTab === 'fontes' && (
              <div className="space-y-3">
                {[
                  { id: 'classic', name: 'Clássico', font: 'font-bold' },
                  { id: 'serif', name: 'Elegante', font: 'font-serif italic' }
                ].map((f) => (
                  <button key={f.id} onClick={() => setNumberStyle(f.id)} className={`w-full p-6 rounded-2xl border-2 flex justify-between items-center transition-all ${numberStyle === f.id ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5'}`}>
                    <span className="font-bold text-sm">{f.name}</span>
                    <span className={`text-2xl ${f.font} text-primary`}>42</span>
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'icones' && (
              <div className="grid grid-cols-4 gap-4">
                {['stars', 'favorite', 'blur_on', 'check_circle', 'circle', 'square', 'close', 'pets'].map((icon) => (
                  <button key={icon} onClick={() => setStampIcon(icon)} className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${stampIcon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 opacity-40'}`}>
                    <span className="material-symbols-outlined text-4xl">{icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
