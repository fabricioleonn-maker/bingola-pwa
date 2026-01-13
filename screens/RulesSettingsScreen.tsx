
import React, { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

export const RulesSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [rules, setRules] = useState({
    cheia: true,
    cinquina: false,
    cantos: false,
    x: false
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('bingola_game_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.rules) {
          setRules(settings.rules);
        }
      } catch (e) {
        console.error("Erro ao carregar regras");
      }
    }
  }, []);

  const toggleRule = (key: keyof typeof rules) => {
    const activeCount = Object.values(rules).filter(v => v).length;
    // SEGURANÇA: Impede desmarcar se for a última regra ativa
    if (rules[key] && activeCount === 1) {
      alert("A mesa deve ter pelo menos um modo de vitória ativo!");
      return;
    }
    setRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    const currentSettings = JSON.parse(localStorage.getItem('bingola_game_settings') || '{}');
    const newSettings = { ...currentSettings, rules };
    localStorage.setItem('bingola_game_settings', JSON.stringify(newSettings));
    onBack();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-white">
      <header className="sticky top-0 z-50 flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between">
        <button onClick={onBack} className="text-gray-800 dark:text-white flex size-12 items-center justify-start">
          <span className="material-symbols-outlined cursor-pointer">arrow_back_ios</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold flex-1 text-center">Regras da Mesa</h2>
        <div className="w-12"></div>
      </header>

      <main className="flex-1 px-4">
        <div className="pt-4 pb-2">
          <h3 className="text-gray-900 dark:text-white text-xl font-extrabold tracking-tight">Modos de Vitória</h3>
          <p className="text-gray-500 dark:text-[#b9a89d] text-sm mt-1">Defina quais padrões serão premiados. (Selecione ao menos 1)</p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {[
            { id: 'cheia', label: 'Cartela Cheia', desc: 'Completar todos os 24 ou 25 números.', icon: 'grid_view' },
            { id: 'cinquina', label: 'Cinquina', desc: 'Qualquer linha horizontal completa.', icon: 'view_headline' },
            { id: 'cantos', label: 'Quatro Cantos', desc: 'Marcar os quatro números das extremidades.', icon: 'select_window' },
            { id: 'x', label: 'Cartela em X', desc: 'As duas diagonais completas da cartela.', icon: 'close' }
          ].map((rule) => (
            <div key={rule.id} className="flex items-center gap-4 bg-white dark:bg-[#221810] px-4 min-h-[88px] py-4 justify-between rounded-xl border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-12">
                  <span className="material-symbols-outlined text-3xl">{rule.icon}</span>
                </div>
                <div className="flex flex-col justify-center text-left">
                  <p className="text-gray-900 dark:text-white text-base font-semibold leading-normal">{rule.label}</p>
                  <p className="text-gray-500 dark:text-[#b9a89d] text-xs font-normal leading-tight">{rule.desc}</p>
                </div>
              </div>
              <button 
                onClick={() => toggleRule(rule.id as keyof typeof rules)}
                className={`relative flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-all duration-300 ${rules[rule.id as keyof typeof rules] ? 'bg-primary justify-end' : 'bg-gray-200 dark:bg-[#392f28] justify-start'}`}
              >
                <div className="h-6 w-6 rounded-full bg-white shadow-md"></div>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
          <div className="flex items-center gap-3 mb-3 text-primary">
            <span className="material-symbols-outlined">auto_awesome</span>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Dinâmica de Prêmios</span>
          </div>
          <p className="text-gray-600 dark:text-[#b9a89d] text-sm leading-relaxed font-medium">
            Você pode ativar múltiplas regras simultaneamente. Os prêmios serão distribuídos conforme os jogadores atingirem os padrões durante o sorteio.
          </p>
        </div>
      </main>

      <footer className="p-4 bg-background-light dark:bg-background-dark/95 backdrop-blur-md sticky bottom-0">
        <button onClick={handleSave} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">
          CONFIRMAR REGRAS
        </button>
      </footer>
    </div>
  );
};
