
import React, { useState, useEffect } from 'react';
import { useUserStore } from '../state/userStore';
import { useNotificationStore } from '../state/notificationStore';
import { SubscriptionModal } from '../components/SubscriptionModal';

interface Props {
  onBack: () => void;
}

type TabType = 'cores' | 'fontes' | 'icones';

export const CustomizationScreen: React.FC<Props> = ({ onBack }) => {
  const { isPremium } = useUserStore();
  const { show } = useNotificationStore();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

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
    { id: 'classic', name: 'Original', desc: 'Design moderno e limpo', icon: 'grid_view', premium: false },
    { id: 'retro', name: 'Retrô Cassino', desc: 'O clássico inesquecível', icon: 'casino', premium: true },
    { id: 'neon', name: 'Vegas Neon', desc: 'Alta voltagem e brilho', icon: 'bolt', premium: true },
    { id: 'minimal', name: 'Minimalista', desc: 'Foco nos números', icon: 'crop_square', premium: true }
  ];

  const fonts = [
    { id: 'classic', name: 'Clássico', font: 'font-bold', premium: false },
    { id: 'serif', name: 'Elegante', font: 'font-serif italic', premium: true },
    { id: 'modern', name: 'Moderno', font: 'font-mono tracking-tighter', premium: true },
    { id: 'gamer', name: 'Gamer Pop', font: 'font-gamer text-2xl tracking-widest', premium: true },
    { id: 'future', name: 'Futurista', font: 'font-modernPro', premium: true },
    { id: 'college', name: 'Vintage', font: 'font-college', premium: true },
    { id: 'hand', name: 'Manuscrito', font: 'font-handwriting text-2xl lowercase', premium: true }
  ];

  const icons = [
    { id: 'close', name: 'X', icon: 'close', premium: false },
    { id: 'check', name: 'Check', icon: 'check_circle', premium: true },
    { id: 'square', name: 'Quadrado', icon: 'crop_square', premium: true },
    { id: 'circle', name: 'Círculo', icon: 'circle', premium: true },
    { id: 'stars', name: 'Estrela', icon: 'stars', premium: true },
    { id: 'favorite', name: 'Coração', icon: 'favorite', premium: true },
    { id: 'pets', name: 'Patinha', icon: 'pets', premium: true },
    { id: 'blur', name: 'Névoa', icon: 'blur_on', premium: true },

    // Novas opções atrativas
    { id: 'car', name: 'Carrinho', icon: 'directions_car', premium: true },
    { id: 'smile', name: 'Carinha', icon: 'mood', premium: true },
    { id: 'rocket', name: 'Foguete', icon: 'rocket_launch', premium: true },
    { id: 'trophy', name: 'Troféu', icon: 'emoji_events', premium: true },
    { id: 'crown', name: 'Coroa', icon: 'crown', premium: true },
    { id: 'diamond', name: 'Diamante', icon: 'diamond', premium: true },
    { id: 'bolt', name: 'Raio', icon: 'bolt', premium: true }
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

  const handleSelect = (item: any, type: 'theme' | 'font' | 'icon') => {
    if (item.premium && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    if (type === 'theme') setSelectedTheme(item.id);
    if (type === 'font') setNumberStyle(item.id);
    if (type === 'icon') setStampIcon(item.icon);
  };

  const getPreviewStyles = () => {
    switch (selectedTheme) {
      case 'retro': return { cardBg: 'bg-[#f0e6d2]', cellBg: 'bg-white', textColor: 'text-[#4a3a2a]', border: 'border-[#d6ccb8]' };
      case 'neon': return { cardBg: 'bg-[#0a0a0a]', cellBg: 'bg-[#1a1a1a]', textColor: 'text-white/90', border: 'border-primary/20' };
      case 'minimal': return { cardBg: 'bg-white shadow-2xl', cellBg: 'bg-transparent', textColor: 'text-zinc-900', border: 'border-transparent' };
      default: return { cardBg: 'bg-gray-50', cellBg: 'bg-white', textColor: 'text-zinc-800', border: 'border-gray-200' };
    }
  };

  const preview = getPreviewStyles();

  return (
    <div className="flex flex-col min-h-screen bg-background-dark font-display text-white">
      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />

      <header className="sticky top-0 z-50 flex items-center bg-background-dark/95 backdrop-blur-md p-4 border-b border-white/5 justify-between">
        <button onClick={onBack} className="text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-lg font-bold">Personalização</h2>
        <button onClick={handleSave} className="text-primary font-black text-sm uppercase italic">Salvar</button>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        <div className="pt-6">
          <h3 className="px-6 text-xs font-bold text-white/40 uppercase mb-4 tracking-widest">Temas</h3>
          <div className="grid grid-cols-2 gap-4 px-6 pb-6">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t, 'theme')}
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 relative ${selectedTheme === t.id ? 'border-primary bg-primary/20 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'}`}
              >
                {t.premium && !isPremium && (
                  <div className="absolute top-2 right-2 text-primary">
                    <span className="material-symbols-outlined text-sm">lock</span>
                  </div>
                )}
                <span className="material-symbols-outlined text-3xl mb-1">{t.icon}</span>
                <div className="text-center">
                  <h4 className="font-black text-xs uppercase tracking-wider">{t.name}</h4>
                  <p className="text-[9px] font-medium opacity-60 leading-tight mt-1">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col items-center">
          <div className={`w-full max-w-[300px] aspect-[4/5] rounded-[3rem] overflow-hidden flex flex-col p-4 border-8 shadow-2xl ${preview.cardBg} ${preview.border}`}>
            <div className="h-[12%] rounded-t-2xl flex items-center justify-around" style={{ backgroundColor: cardColor }}>
              {['B', 'I', 'N', 'G', 'O'].map(l => <span key={l} className="text-white font-black text-xl">{l}</span>)}
            </div>
            <div className="flex-1 grid grid-cols-5 gap-1.5 mt-2">
              {[4, 21, 35, 52, 68, 7, 28, 44, 49, 63, 12, 19, 0, 58, 71, 3, 25, 33, 55, 66, 15, 22, 40, 50, 75].map((cell, i) => (
                <div key={i} className={`aspect-square flex items-center justify-center rounded-xl font-black text-base relative border transition-all ${cell === 0 ? 'bg-primary/20 border-primary/40' : `${preview.cellBg} ${preview.border} ${preview.textColor}`}`}>
                  {cell === 0 ? (
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[6px] text-primary font-black uppercase">BINGOLA</span>
                      <span className="text-[7px] text-primary font-black uppercase">LIVRE</span>
                    </div>
                  ) : (
                    <span className={`${{
                        classic: 'font-bold',
                        serif: 'font-serif',
                        modern: 'font-mono',
                        gamer: 'font-gamer',
                        future: 'font-modernPro',
                        college: 'font-college',
                        hand: 'font-handwriting'
                      }[numberStyle] || 'font-bold'
                      }`}>{cell}</span>
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
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-3">Cor da Marcação</h4>
                  <div className="flex justify-center gap-6">
                    {colors.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setCardColor(c.hex)}
                        className={`shrink-0 size-12 rounded-full border-4 transition-all ${cardColor === c.hex ? 'border-white scale-125 shadow-xl shadow-white/20' : 'border-transparent opacity-60'}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-white/40">Transparência da Marcação</h4>
                    <span className="text-xs font-bold text-primary">{opacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            )}

            {activeTab === 'fontes' && (
              <div className="space-y-3">
                {fonts.map((f) => (
                  <button key={f.id} onClick={() => handleSelect(f, 'font')} className={`w-full p-6 rounded-2xl border-2 flex justify-between items-center transition-all relative ${numberStyle === f.id ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5'}`}>
                    {f.premium && !isPremium && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-4 text-primary">
                        <span className="material-symbols-outlined text-xl">lock</span>
                      </div>
                    )}
                    <span className="font-bold text-sm">{f.name}</span>
                    <span className={`text-2xl ${f.font} text-primary ${f.premium && !isPremium ? 'opacity-30 blur-[2px]' : ''}`}>42</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'icones' && (
              <div className="grid grid-cols-4 gap-4">
                {icons.map((item) => (
                  <button key={item.id} onClick={() => handleSelect(item, 'icon')} className={`aspect-square rounded-2xl flex items-center justify-center transition-all relative ${stampIcon === item.icon ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 opacity-40'}`}>
                    {item.premium && !isPremium && (
                      <div className="absolute top-1 right-1 text-primary">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                      </div>
                    )}
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
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
