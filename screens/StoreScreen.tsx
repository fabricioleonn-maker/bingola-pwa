
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

interface Props {
  onBack: () => void;
}

export const StoreScreen: React.FC<Props> = ({ onBack }) => {
  const [balance, setBalance] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfileId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('bcoins')
          .eq('id', user.id)
          .single();
        if (profile) setBalance(profile.bcoins || 0);
      }
    };
    fetchBalance();
  }, []);

  const buyPackage = async (coins: number) => {
    if (!profileId) {
      // Caso explorador sem conta, permitimos "comprar" para testar o app
      const mockBalance = balance + coins;
      setBalance(mockBalance);
      useNotificationStore.getState().show("Simulação: Como você não está logado, adicionamos bcoins temporários para teste.", 'info');
      return;
    }

    const newBalance = balance + coins;
    const { error } = await supabase
      .from('profiles')
      .update({ bcoins: newBalance })
      .eq('id', profileId);

    if (error) {
      useNotificationStore.getState().show("Erro ao processar compra. Tente novamente.", 'error');
    } else {
      setBalance(newBalance);
      useNotificationStore.getState().show(`Você adquiriu ${coins} BCOINS com sucesso!`, 'success');
    }
  };

  const packages = [
    { coins: 10, title: 'Pacote Iniciante', price: '4,90', oldPrice: '5,45', disc: '10% OFF', icon: 'circle_notifications' },
    { coins: 50, title: 'Pacote Família', price: '19,90', oldPrice: '24,90', disc: '20% OFF', icon: 'stack', popular: true, bonus: '+5 GRÁTIS' },
    { coins: 200, title: 'Baú da Sorte', price: '69,99', oldPrice: '99,99', disc: '30% OFF', icon: 'featured_seasonal_and_gifts', mega: true, bonus: '+30 BÔNUS' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <header className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Loja de BCOINS</h2>
        <button className="w-10 h-10 flex items-center justify-center rounded-full text-white/40">
          <span className="material-symbols-outlined">help</span>
        </button>
      </header>

      <main className="flex-1 p-4 space-y-8">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Seu Saldo Atual</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black">{balance}</span>
                <span className="text-primary font-bold text-xl tracking-tighter">BCOINS</span>
              </div>
              <p className="text-white/40 text-xs">Créditos disponíveis para mesas</p>
            </div>
            <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black">Escolha um Pacote</h3>
            <div className="bg-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Promoção</div>
          </div>

          <div className="space-y-6">
            {packages.map((pkg, i) => (
              <div key={i} className={`relative rounded-3xl overflow-hidden bg-white/5 border transition-all ${pkg.popular ? 'border-primary ring-2 ring-primary/20' : 'border-white/10'}`}>
                {pkg.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-b-xl shadow-lg">
                    Mais Vendido
                  </div>
                )}
                <div className="p-6 flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center relative flex-shrink-0 ${pkg.mega ? 'bg-gradient-to-t from-background-dark to-primary/10' : 'bg-primary/10'}`}>
                    <span className="material-symbols-outlined text-primary text-4xl">{pkg.icon}</span>
                    {pkg.bonus && <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg border-2 border-background-dark">{pkg.bonus}</div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-black">{pkg.coins} BCOINS</p>
                    <p className="text-xs text-white/40 mb-3">{pkg.title}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-white/20 line-through">R$ {pkg.oldPrice}</span>
                      <span className="text-2xl font-black text-primary">R$ {pkg.price}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="bg-red-600 text-[9px] font-black text-white px-2 py-0.5 rounded-full text-center">{pkg.disc}</div>
                    <button
                      onClick={() => buyPackage(pkg.coins)}
                      className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-black active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
