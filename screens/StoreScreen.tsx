
import { Capacitor } from '@capacitor/core';

// ... existing imports ...

export const StoreScreen: React.FC<Props> = ({ onBack }) => {
  const isNative = Capacitor.isNativePlatform();
  // ... existing hooks ...

  // ... (inside component)

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* PWA/Web Blocking Overlay for Purchases */}
      {!isNative && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="bg-surface-dark border border-white/10 rounded-3xl p-8 max-w-sm shadow-2xl relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 p-4 rounded-full shadow-xl shadow-yellow-500/20">
              <span className="material-symbols-outlined text-black text-4xl">lock</span>
            </div>
            <h3 className="text-2xl font-black text-white mt-8 mb-4 uppercase italic">Loja Exclusiva App</h3>
            <p className="text-white/60 text-sm mb-8 leading-relaxed">
              As compras de BCOINS só podem ser realizadas através do nosso aplicativo oficial na Play Store para garantir sua segurança.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={onBack} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl uppercase text-xs tracking-widest transition-all">
                Voltar
              </button>
              {/* Link to Play Store could be added here later */}
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Loja de BCOINS</h2>
        <button className="w-10 h-10 flex items-center justify-center rounded-full text-white/40">
          <span className="material-symbols-outlined">help</span>
        </button>
      </header>

      <main className="flex-1 p-4 space-y-8 pb-20 opacity-50 pointer-events-none grayscale">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Seu Saldo Atual</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white">{profile?.bcoins || 0}</span>
                <span className="text-primary font-bold text-xl tracking-tighter">BCOINS</span>
              </div>
              <p className="text-white/40 text-xs">Créditos disponíveis para mesas</p>
            </div>
            <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-3xl">payments</span>
            </div>
          </div>
        </section>

        {/* Premium Subscription Card */}
        {!isPremium && (
          <section
            id="premium-promo-card"
            onClick={() => setShowSubscriptionModal(true)}
            className="bg-gradient-to-br from-stone-900 to-black border-2 border-yellow-500/20 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer mb-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-yellow-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="size-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center ring-1 ring-yellow-500/30">
                <span className="material-symbols-outlined text-yellow-500 text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">crown</span>
              </div>
              <div className="bg-yellow-500 text-black text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                Ouro
              </div>
            </div>
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Seja Premium</h3>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed mb-6 max-w-[240px]">
              Libere todos os temas, fontes e ganhe <span className="text-yellow-500 font-black">10% de desconto extra</span> em BCOINS!
            </p>
            <div className="flex items-center gap-2 text-yellow-500 font-black text-xs italic">
              ASSINAR AGORA <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black uppercase tracking-tight text-white italic">Escolha um Pacote</h3>
            {globalPromo?.active && (
              <div className="bg-primary px-3 py-1 rounded-full text-[9px] font-black uppercase text-black animate-pulse">
                {globalPromo.label} -{globalPromo.discount}% OFF
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages.map((pkg, i) => (
              <div key={i} className={`relative rounded-3xl overflow-hidden bg-white/5 border transition-all hover:scale-[1.02] ${pkg.popular || pkg.is_popular ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] bg-gradient-to-br from-white/5 to-primary/10' : 'border-white/10 hover:border-white/20'}`}>
                {(pkg.popular || pkg.is_popular) && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-black uppercase tracking-widest px-6 py-1.5 rounded-b-xl shadow-lg z-10 whitespace-nowrap">
                    ⭐ Mais Vendido ⭐
                  </div>
                )}
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative flex-shrink-0 ${pkg.mega ? 'bg-gradient-to-t from-background-dark to-primary/10' : 'bg-black/20'}`}>
                      <span className="material-symbols-outlined text-primary text-3xl">{pkg.icon}</span>
                      {pkg.bonus && <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg border-2 border-background-dark">{pkg.bonus}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-black text-white truncate">{pkg.coins} BCOINS</p>
                      <p className="text-[9px] font-black uppercase text-white/50 truncate leading-tight">{pkg.title}</p>
                    </div>
                  </div>

                  {pkg.description && (
                    <div className="bg-black/20 p-2 rounded-lg">
                      <p className="text-[9px] font-bold text-white/60 lowercase italic text-center leading-tight">"{pkg.description}"</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                    <div className="flex flex-col">
                      {(pkg.promo_price || globalPromo?.active) && (
                        <span className="text-[10px] text-white/30 line-through">
                          R$ {(pkg.promo_price ? pkg.price : pkg.price).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                      <span className="text-xl font-black text-primary drop-shadow-md">
                        R$ {getPackagePrice(pkg).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <button
                      onClick={() => addToCart(pkg)}
                      className="h-10 px-5 bg-primary rounded-xl flex items-center justify-center text-black active:scale-95 transition-all shadow-lg hover:shadow-primary/30"
                    >
                      <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
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

          <div className="space-y-4 max-h-48 overflow-y-auto pr-2 no-scrollbar">
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
            <div className="flex justify-between items-center text-green-500">
              <span className="text-xs font-bold uppercase tracking-widest">Total BCOINS</span>
              <span className="text-lg font-black">+{getTotalCoins()}</span>
            </div>

            {appliedCoupon && (
              <div className="flex justify-between items-center text-primary">
                <span className="text-xs font-bold uppercase tracking-widest">Desconto Cupom ({appliedCoupon.discount}%)</span>
                <span className="text-sm font-black">- R$ {(getGrossTotal() * (appliedCoupon.discount / 100)).toFixed(2).replace('.', ',')}</span>
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
                  disabled={!!appliedCoupon}
                  placeholder="DIGITE O CÓDIGO"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider focus:border-primary/50 outline-none disabled:opacity-50"
                />
                {appliedCoupon && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500">check_circle</span>
                )}
              </div>
              <button
                onClick={appliedCoupon ? () => { setAppliedCoupon(null); setReferrerId(null); } : applyPromoCode}
                className={`px-6 rounded-xl font-black text-[10px] uppercase transition-all ${appliedCoupon ? 'bg-white/10 text-white/40' : 'bg-primary text-black shadow-lg shadow-primary/20'}`}
              >
                {appliedCoupon ? 'REMOVER' : 'APLICAR'}
              </button>
            </div>
            {promoError && <p className="text-red-500 text-[10px] font-bold uppercase">{promoError}</p>}
            {appliedCoupon && (
              <p className="text-green-500 text-[10px] font-bold uppercase">
                Cupom {appliedCoupon.code} Ativo! -{appliedCoupon.discount}% DESCONTO 🔥
                {referrerId && <span className="block text-[8px] opacity-70">Indicação de @{referrerName}</span>}
              </p>
            )}
          </div>

          <button
            onClick={finalizePurchase}
            disabled={isFinishing || cart.length === 0}
            className="w-full h-20 bg-primary text-black font-black text-xl rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all uppercase italic disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isFinishing ? (
              <>
                <span className="material-symbols-outlined animate-spin">refresh</span>
                PROCESSANDO...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">shopping_cart_checkout</span>
                FINALIZAR COMPRA
              </>
            )}
          </button>
        </section>
      </main>

      {/* Modals */}
      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
      <RewardNotificationModal />

      {/* Thank You Modal */}
      {showThankYou && (
        <div className="fixed inset-0 z-[300] bg-background-dark/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="w-full max-w-[380px] bg-surface-dark border border-white/10 rounded-[3rem] p-10 text-center relative overflow-hidden shadow-2xl">
            {/* Success Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/20 blur-[80px] -mt-24"></div>

            <div className="relative z-10">
              <div className="size-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/20 animate-bounce">
                <span className="material-symbols-outlined text-black text-5xl font-black">check</span>
              </div>

              <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2 uppercase">SUCESSO!</h2>
              <p className="text-white/40 text-sm mb-10 font-medium">Sua compra foi processada com sucesso. Divirta-se nas mesas!</p>

              <div className="bg-white/5 rounded-3xl p-6 mb-10 space-y-4 border border-white/5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/20 font-black uppercase tracking-widest">Adicionado</span>
                  <span className="text-primary font-black">+{lastPurchase?.coins} BCOINS</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/20 font-black uppercase tracking-widest">Valor</span>
                  <span className="text-white font-black">R$ {lastPurchase?.total?.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/10 font-bold uppercase">Pagamento</span>
                  <span className="text-white/40 font-bold">{lastPurchase?.method}</span>
                </div>
              </div>

              <button
                onClick={() => { setShowThankYou(false); onBack(); }}
                className="w-full h-16 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
