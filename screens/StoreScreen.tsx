
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

interface Props {
  onBack: () => void;
}

export const StoreScreen: React.FC<Props> = ({ onBack }) => {
  const [balance, setBalance] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState('');
  const [cart, setCart] = useState<{ id: string, coins: number, price: number, title: string }[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);

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

  const addToCart = (pkg: any) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      coins: pkg.coins,
      price: parseFloat(pkg.price.replace(',', '.')),
      title: pkg.title
    };
    setCart([...cart, newItem]);
    useNotificationStore.getState().show(`${pkg.coins} BCOINS adicionados ao carrinho!`, 'info');
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const getGrossTotal = () => cart.reduce((acc, item) => acc + item.price, 0);
  const getNetTotal = () => {
    const gross = getGrossTotal();
    return isPromoApplied ? gross * 0.9 : gross; // 10% discount if promo applied
  };

  const getTotalCoins = () => {
    const base = cart.reduce((acc, item) => acc + item.coins, 0);
    return isPromoApplied ? Math.floor(base * 1.1) : base; // 10% bonus coins if promo applied
  };

  const finalizePurchase = async () => {
    if (cart.length === 0) return;
    setIsFinishing(true);

    if (!profileId) {
      const addedCoins = getTotalCoins();
      setBalance(balance + addedCoins);
      useNotificationStore.getState().show(`Checkout Simulado: +${addedCoins} BCOINS Adicionados!`, 'success');
      setCart([]);
      setIsFinishing(false);
      return;
    }

    const addedCoins = getTotalCoins();
    const newBalance = balance + addedCoins;

    // 1. Update buyer
    const { error } = await supabase
      .from('profiles')
      .update({ bcoins: newBalance })
      .eq('id', profileId);

    if (error) {
      useNotificationStore.getState().show("Erro ao processar checkout. Tente novamente.", 'error');
      setIsFinishing(false);
      return;
    }

    // 2. Reward referrer if applicable
    if (referrerId) {
      const { data: myProfile } = await supabase.from('profiles').select('referred_by').eq('id', profileId).single();
      if (myProfile && !myProfile.referred_by) {
        const { data: refProfile } = await supabase.from('profiles').select('bcoins').eq('id', referrerId).single();
        if (refProfile) {
          await supabase.from('profiles').update({ bcoins: (refProfile.bcoins || 0) + 50 }).eq('id', referrerId);
        }
        await supabase.from('profiles').update({ referred_by: referrerId }).eq('id', profileId);
      }
    }

    setBalance(newBalance);
    setIsPromoApplied(false);
    setPromoCode('');
    setReferrerId(null);
    setCart([]);
    setIsFinishing(false);
    useNotificationStore.getState().show(`Checkout Concluído! +${addedCoins} BCOINS Adicionados.`, 'success');

    // Future integration placeholder
    console.log("[Checkout] Redirecting to payment platform...");
    // onBack(); 
  };

  const applyPromoCode = async () => {
    setPromoError('');
    if (!promoCode.trim()) return;

    try {
      const { data: referrer, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('referral_code', promoCode.trim().toUpperCase())
        .single();

      if (error || !referrer) {
        setPromoError('Código inválido ou inexistente.');
        return;
      }

      if (referrer.id === profileId) {
        setPromoError('Você não pode usar seu próprio código.');
        return;
      }

      setIsPromoApplied(true);
      setReferrerId(referrer.id);
      setReferrerName(referrer.username || 'Amigo');
      useNotificationStore.getState().show(`Código de @${referrer.username} aplicado! +10% de BCOINS em qualquer pacote.`, 'success');
    } catch (err) {
      setPromoError('Erro ao validar código.');
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

      <main className="flex-1 p-4 space-y-8 pb-20">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Seu Saldo Atual</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white">{balance}</span>
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
                      onClick={() => addToCart(pkg)}
                      className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-black active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined">add_shopping_cart</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Carrinho de Compras */}
        <section className="bg-surface-dark border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black italic">Resumo da Compra</h3>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black">{cart.length} ITENS</span>
          </div>

          <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
            {cart.length === 0 ? (
              <p className="text-center text-white/20 text-xs py-4 uppercase font-bold italic tracking-widest">Nenhum pacote selecionado</p>
            ) : cart.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div>
                  <p className="font-black text-sm">{item.coins} BCOINS</p>
                  <p className="text-[10px] text-white/30 uppercase font-bold">{item.title}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-black text-primary text-sm">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                  <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-red-500/50 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Subtotal</span>
              <span className="text-sm font-black">R$ {getGrossTotal().toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="flex justify-between items-center text-green-500">
              <span className="text-xs font-bold uppercase tracking-widest">Total BCOINS</span>
              <span className="text-lg font-black">+{getTotalCoins()}</span>
            </div>

            {isPromoApplied && (
              <div className="flex justify-between items-center text-primary">
                <span className="text-xs font-bold uppercase tracking-widest">Desconto Cupom (10%)</span>
                <span className="text-sm font-black">- R$ {(getGrossTotal() * 0.1).toFixed(2).replace('.', ',')}</span>
              </div>
            )}

            <div className="flex justify-between items-end pt-2">
              <span className="text-lg font-black uppercase italic italic">TOTAL</span>
              <div className="text-right">
                <p className="text-4xl font-black text-primary">R$ {getNetTotal().toFixed(2).replace('.', ',')}</p>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">IPI e Taxas inclusos</p>
              </div>
            </div>
          </div>

          {/* Cupom Section */}
          <div className="pt-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Código de Desconto</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={isPromoApplied}
                  placeholder="DIGITE O CÓDIGO"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider focus:border-primary/50 outline-none disabled:opacity-50"
                />
                {isPromoApplied && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500">check_circle</span>
                )}
              </div>
              <button
                onClick={isPromoApplied ? () => { setIsPromoApplied(false); setReferrerId(null); } : applyPromoCode}
                className={`px-6 rounded-xl font-black text-[10px] uppercase transition-all ${isPromoApplied ? 'bg-white/10 text-white/40' : 'bg-primary text-black shadow-lg shadow-primary/20'}`}
              >
                {isPromoApplied ? 'REMOVER' : 'APLICAR'}
              </button>
            </div>
            {promoError && <p className="text-red-500 text-[10px] font-bold uppercase">{promoError}</p>}
            {isPromoApplied && <p className="text-green-500 text-[10px] font-bold uppercase">Código de @{referrerName} Ativo! +10% BCOINS 🔥</p>}
          </div>

          <button
            onClick={finalizePurchase}
            disabled={cart.length === 0 || isFinishing}
            className="w-full h-20 bg-primary text-white font-black text-xl rounded-2xl shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale uppercase italic"
          >
            {isFinishing ? 'PROCESSANDO...' : 'CONCLUIR COMPRA'}
          </button>
        </section>
      </main>
    </div>
  );
};
