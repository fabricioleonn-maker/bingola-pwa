
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

interface StoreProduct {
    id: string;
    coins: number;
    title: string;
    price: number;
    promo_price: number | null;
    is_active: boolean;
    is_popular: boolean;
    icon: string;
    bonus_text: string | null;
    description: string | null;
    product_id?: string;
}

interface StoreCoupon {
    id: string;
    code: string;
    discount_percent: number;
    is_active: boolean;
    max_uses: number | null;
    current_uses: number;
    expires_at: string | null;
}

interface Props {
    onBack: () => void;
}

export const StoreAdminScreen: React.FC<Props> = ({ onBack }) => {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Global Promo states
    const [promoActive, setPromoActive] = useState(false);
    const [promoLabel, setPromoLabel] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [catalog, setCatalog] = useState<any[]>([]);

    // Form states
    const [editingProduct, setEditingProduct] = useState<Partial<StoreProduct> | null>(null);
    const [editingCoupon, setEditingCoupon] = useState<Partial<StoreCoupon> | null>(null);

    // Search state for dropdown
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        const { data: productsData } = await supabase.from('store_products').select('*').order('display_order', { ascending: true });
        const { data: couponsData } = await supabase.from('store_coupons').select('*').order('created_at', { ascending: false });
        const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single();

        setProducts(productsData || []);
        setCoupons(couponsData || []);
        if (settings) {
            setPromoActive(settings.store_promo_active);
            setPromoLabel(settings.store_promo_label);
            setPromoDiscount(settings.store_promo_discount);
        }

        // Fetch Catalog for dropdown
        const { data: catalogData } = await supabase.from('product_catalog').select('*');
        if (catalogData) setCatalog(catalogData);

        setIsLoading(false);
    };

    const saveProduct = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            const { error } = editingProduct.id
                ? await supabase.from('store_products').update(editingProduct).eq('id', editingProduct.id)
                : await supabase.from('store_products').insert(editingProduct);

            if (error) throw error;
            useNotificationStore.getState().show('Produto salvo!', 'success');
            setEditingProduct(null);
            fetchData();
        } catch (err: any) {
            useNotificationStore.getState().show(err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const saveCoupon = async () => {
        if (!editingCoupon) return;
        setIsSaving(true);
        try {
            const { error } = editingCoupon.id
                ? await supabase.from('store_coupons').update(editingCoupon).eq('id', editingCoupon.id)
                : await supabase.from('store_coupons').insert(editingCoupon);

            if (error) throw error;
            useNotificationStore.getState().show('Cupom salvo!', 'success');
            setEditingCoupon(null);
            fetchData();
        } catch (err: any) {
            useNotificationStore.getState().show(err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleProductActive = async (id: string, current: boolean) => {
        await supabase.from('store_products').update({ is_active: !current }).eq('id', id);
        fetchData();
    };

    const deleteCoupon = async (id: string, code: string) => {
        if (!confirm(`Deseja realmente excluir o cupom ${code}? Esta ação não pode ser desfeita.`)) return;

        try {
            const { error } = await supabase.from('store_coupons').delete().eq('id', id);
            if (error) throw error;
            useNotificationStore.getState().show(`Cupom ${code} excluído.`, 'success');
            fetchData();
        } catch (err: any) {
            useNotificationStore.getState().show(err.message, 'error');
        }
    };

    const deleteProduct = async (id: string, title: string) => {
        if (!confirm(`Deseja realmente excluir o produto "${title}"? Esta ação não pode ser desfeita.`)) return;

        try {
            const { error } = await supabase.from('store_products').delete().eq('id', id);
            if (error) throw error;
            useNotificationStore.getState().show(`Produto excluído.`, 'success');
            fetchData();
        } catch (err: any) {
            useNotificationStore.getState().show(err.message, 'error');
        }
    };

    const handleEditProduct = (p: StoreProduct) => {
        setEditingProduct(p);
        // Initialize search term if product is linked
        if (p.product_id) {
            const catalogItem = catalog.find(c => c.product_id === p.product_id);
            if (catalogItem) {
                setSearchTerm(`${catalogItem.bcoins_amount} BCOINS (${catalogItem.store_google_sku})`);
            } else {
                setSearchTerm(p.product_id); // Fallback
            }
        } else {
            setSearchTerm('');
        }
    };

    const saveGlobalPromo = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('app_settings').update({
                store_promo_active: promoActive,
                store_promo_label: promoLabel,
                store_promo_discount: promoDiscount
            }).eq('id', 1);

            if (error) throw error;
            useNotificationStore.getState().show('Configurações globais salvas!', 'success');
            fetchData();
        } catch (err: any) {
            useNotificationStore.getState().show(err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Catalog Creation Logic
    const [isCreatingCatalog, setIsCreatingCatalog] = useState(false);
    const [newCatalogCoins, setNewCatalogCoins] = useState<number | ''>('');

    const saveCatalogItem = async () => {
        if (!newCatalogCoins || newCatalogCoins <= 0) {
            useNotificationStore.getState().show('Digite uma quantidade válida', 'error');
            return;
        }

        setIsSaving(true);
        const amount = Number(newCatalogCoins);
        const productId = `bcoins_pack_${amount}`;
        const sku = `bcoins_${amount}`;
        const appleId = `com.bingola.bcoins.${amount}`;

        try {
            const { error } = await supabase.from('product_catalog').insert({
                product_id: productId,
                store_google_sku: sku,
                store_apple_product_id: appleId,
                bcoins_amount: amount
            });

            if (error) throw error;

            useNotificationStore.getState().show(`Pacote de ${amount} BCOINS criado no backend!`, 'success');
            setIsCreatingCatalog(false);
            setNewCatalogCoins('');
            await fetchData();

            // Auto-select the new item if editing a product
            if (editingProduct) {
                setEditingProduct(prev => ({ ...prev, product_id: productId } as any));
            }
        } catch (err: any) {
            useNotificationStore.getState().show('Erro ao criar item: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dark">
            <header className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <h2 className="text-sm font-black uppercase tracking-widest italic">Gestão da Loja</h2>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 p-6 space-y-10 pb-24 max-w-[430px] mx-auto w-full">
                {/* GLOBAL PROMO SECTION */}
                <section className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-xl">campaign</span>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Promoção Toda Loja</h3>
                        </div>
                        <button
                            onClick={() => setPromoActive(!promoActive)}
                            className={`w-12 h-6 rounded-full relative transition-colors ${promoActive ? 'bg-primary' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-black rounded-full transition-all ${promoActive ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-white/30 uppercase pl-1">Nome da Promoção</p>
                            <input
                                type="text"
                                value={promoLabel}
                                onChange={e => setPromoLabel(e.target.value.toUpperCase())}
                                placeholder="EX: PROMO DE LANÇAMENTO"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-primary/30 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-white/30 uppercase pl-1">Porcentagem de Desconto: {promoDiscount}%</p>
                            <input
                                type="range"
                                min="0" max="100"
                                value={promoDiscount}
                                onChange={e => setPromoDiscount(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/5 rounded-full appearance-none accent-primary"
                            />
                        </div>
                        <button
                            onClick={saveGlobalPromo}
                            disabled={isSaving}
                            className="w-full py-3 bg-primary text-black rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            {isSaving ? 'Salvando...' : 'Aplicar em Toda Loja'}
                        </button>
                    </div>
                </section>

                {/* PRODUCTS SECTION */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Produtos</h3>
                        <button
                            onClick={() => {
                                setEditingProduct({ coins: 0, title: '', price: 0, is_active: true, is_popular: false, icon: 'payments' });
                                setSearchTerm('');
                            }}
                            className="px-4 py-2 bg-primary text-black rounded-lg font-black text-[9px] uppercase shadow-lg shadow-primary/20"
                        >
                            Novo Produto
                        </button>
                    </div>

                    <div className="space-y-4">
                        {products.map(p => (
                            <div key={p.id} className={`bg-white/5 border rounded-2xl p-4 flex items-center justify-between ${p.is_active ? 'border-white/10' : 'border-red-500/20 opacity-50'}`}>
                                <div className="flex items-center gap-4">
                                    <span className="material-symbols-outlined text-primary text-2xl">{p.icon}</span>
                                    <div>
                                        <p className="font-black text-xs uppercase">{p.title}</p>
                                        <p className="text-[10px] font-bold text-white/40">{p.coins} BCOINS • R$ {p.price.toFixed(2)}</p>
                                        {p.promo_price && <p className="text-[10px] font-bold text-green-500">Promo: R$ {p.promo_price.toFixed(2)}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditProduct(p)} className="p-2 text-white/40 hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button onClick={() => toggleProductActive(p.id, p.is_active)} className={`p-2 transition-colors ${p.is_active ? 'text-green-500' : 'text-red-500'}`}>
                                        <span className="material-symbols-outlined text-lg">{p.is_active ? 'visibility' : 'visibility_off'}</span>
                                    </button>
                                    <button onClick={() => deleteProduct(p.id, p.title)} className="p-2 text-red-500/40 hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* COUPONS SECTION */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between border-t border-white/5 pt-10">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Cupons de Desconto</h3>
                        <button
                            onClick={() => setEditingCoupon({ code: '', discount_percent: 10, is_active: true, max_uses: null, current_uses: 0, expires_at: null })}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg font-black text-[9px] uppercase"
                        >
                            Novo Cupom
                        </button>
                    </div>

                    <div className="space-y-4">
                        {coupons.length === 0 ? (
                            <p className="text-center text-[10px] font-bold text-white/10 uppercase py-4">Nenhum cupom ativo</p>
                        ) : coupons.map(c => {
                            const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                            const isExhausted = c.max_uses && c.current_uses >= c.max_uses;
                            const status = !c.is_active ? 'INATIVO' : isExpired ? 'EXPIRADO' : isExhausted ? 'ESGOTADO' : 'ATIVO';
                            const statusColor = !c.is_active ? 'bg-white/10 text-white/40' : isExpired ? 'bg-red-500/10 text-red-500' : isExhausted ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500';

                            return (
                                <div key={c.id} className={`bg-white/5 border rounded-2xl p-4 flex items-center justify-between transition-all ${c.is_active && !isExpired && !isExhausted ? 'border-primary/20' : 'border-white/5 opacity-80'}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-black text-sm text-primary italic tracking-tight">{c.code}</p>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-white/40 uppercase">
                                            {c.discount_percent}% OFF • {c.max_uses ? `${c.current_uses}/${c.max_uses}` : `${c.current_uses}/∞`} usos
                                        </p>
                                        {c.expires_at && (
                                            <p className={`text-[8px] font-black uppercase mt-1 ${isExpired ? 'text-red-500/60' : 'text-white/20'}`}>
                                                Expira: {new Date(c.expires_at).toLocaleString('pt-BR')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setEditingCoupon(c)} className="p-2 text-white/40 hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={async () => { await supabase.from('store_coupons').update({ is_active: !c.is_active }).eq('id', c.id); fetchData(); }} className={`p-2 transition-colors ${c.is_active ? 'text-green-500' : 'text-red-500'}`}>
                                            <span className="material-symbols-outlined text-lg">{c.is_active ? 'visibility' : 'visibility_off'}</span>
                                        </button>
                                        <button onClick={() => deleteCoupon(c.id, c.code)} className="p-2 text-red-500/40 hover:text-red-500 transition-colors">
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* EDITING MODALS */}
            {editingProduct && (
                <div className="fixed inset-0 z-[400] bg-background-dark/95 backdrop-blur-xl p-6 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="w-full max-w-[380px] bg-surface-dark border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
                        <h3 className="font-black uppercase italic tracking-widest text-sm text-center">Configurar Produto</h3>

                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-white/20 uppercase pl-1">Vincular Produto (Backend)</p>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="BUSCAR PACOTE..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-white outline-none focus:border-primary/50 transition-all"
                                        value={searchTerm}
                                        onChange={e => {
                                            setSearchTerm(e.target.value.toUpperCase());
                                            setShowSearch(true);
                                        }}
                                        onFocus={() => setShowSearch(true)}
                                    />
                                    {showSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-surface-dark border border-white/10 rounded-xl shadow-2xl z-50">
                                            {catalog
                                                .filter(c =>
                                                    c.product_id.toUpperCase().includes(searchTerm) ||
                                                    c.bcoins_amount.toString().includes(searchTerm)
                                                )
                                                .sort((a, b) => a.bcoins_amount - b.bcoins_amount)
                                                .map(c => (
                                                    <button
                                                        key={c.product_id}
                                                        onClick={() => {
                                                            setEditingProduct({
                                                                ...editingProduct,
                                                                product_id: c.product_id,
                                                                coins: c.bcoins_amount
                                                            });
                                                            setSearchTerm(`${c.bcoins_amount} BCOINS (${c.store_google_sku})`);
                                                            setShowSearch(false);
                                                        }}
                                                        className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-white hover:bg-white/10 border-b border-white/5 last:border-0"
                                                    >
                                                        {c.bcoins_amount} BCOINS <span className="text-white/40 ml-2">{c.store_google_sku}</span>
                                                    </button>
                                                ))}
                                            {catalog.filter(c => c.product_id.toUpperCase().includes(searchTerm)).length === 0 && (
                                                <div className="px-4 py-3 text-[9px] font-bold text-white/20 uppercase text-center">Nenhum pacote encontrado</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsCreatingCatalog(true)}
                                    className="w-full mt-2 py-2 bg-primary/20 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/30 transition-all"
                                >
                                    + Criar Novo Item no Catálogo
                                </button>
                                {/* Overlay to close search when clicking outside */}
                                {showSearch && <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)}></div>}
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-white/20 uppercase pl-1">Quantidade de BCOINS</p>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-white outline-none focus:border-primary/50 transition-all ${editingProduct.product_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    value={editingProduct?.coins || ''}
                                    onChange={e => setEditingProduct({ ...editingProduct, coins: parseInt(e.target.value) })}
                                    disabled={!!editingProduct.product_id} // Disable if linked
                                />
                                {editingProduct.product_id && <p className="text-[8px] text-primary italic pl-1">* Gerenciado pelo Catálogo</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black text-white/20 uppercase pl-1">Título Visual</p>
                                    <input
                                        type="text"
                                        placeholder="Ex: Pacote Ouro"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-white outline-none focus:border-primary/50 transition-all"
                                        value={editingProduct.title || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black text-white/20 uppercase pl-1">Preço Normal (R$)</p>
                                    <input
                                        type="number"
                                        placeholder="0,00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black text-white outline-none focus:border-primary/50 transition-all"
                                        value={editingProduct.price || ''}
                                        step="0.01"
                                        onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-white/20 uppercase pl-1">Preço Promocional (Opcional)</p>
                                <input
                                    type="number"
                                    placeholder="R$ 0,00 (0 = sem promo)"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black text-white outline-none focus:border-primary/50 transition-all"
                                    value={editingProduct.promo_price || ''}
                                    step="0.01"
                                    onChange={e => setEditingProduct({ ...editingProduct, promo_price: e.target.value ? parseFloat(e.target.value) : null })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-white/20 uppercase pl-1">Descrição Curta (Opcional)</p>
                                <input
                                    type="text"
                                    placeholder="Ex: Ideal para começar a jogar"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-black text-white outline-none focus:border-primary/50 transition-all"
                                    value={editingProduct.description || ''}
                                    onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setEditingProduct({ ...editingProduct, is_popular: !editingProduct.is_popular })} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border transition-all ${editingProduct.is_popular ? 'bg-primary border-primary text-black' : 'border-white/10 text-white/40'}`}>MAIS VENDIDO</button>
                                <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-white/5 text-white/40 rounded-xl text-[9px] font-black uppercase border border-transparent active:scale-95 transition-all">Cancelar</button>
                            </div>
                            <button onClick={saveProduct} disabled={isSaving} className="w-full h-16 bg-primary text-black rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all">{isSaving ? 'Salvando...' : 'Salvar Produto'}</button>
                        </div>
                    </div>
                </div>
            )}

            {editingCoupon && (
                <div className="fixed inset-0 z-[400] bg-background-dark/95 backdrop-blur-xl p-6 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="w-full max-w-[380px] bg-surface-dark border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                        <h3 className="font-black uppercase italic tracking-widest text-sm text-center">Configurar Cupom</h3>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="CÓDIGO (EX: BINGOLA50)"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase text-white"
                                value={editingCoupon.code || ''}
                                onChange={e => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                            />
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-white/20 uppercase text-center">{editingCoupon.discount_percent}% de Desconto</p>
                                <input
                                    type="range"
                                    min="1" max="100"
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary"
                                    value={editingCoupon.discount_percent || 10}
                                    onChange={e => setEditingCoupon({ ...editingCoupon, discount_percent: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-4 pt-2">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-white/20 uppercase">Limite de Usos (0 ou vázio = Ilimitado)</p>
                                    <input
                                        type="number"
                                        placeholder="Máximo de usos"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-white"
                                        value={editingCoupon.max_uses ?? ''}
                                        onChange={e => setEditingCoupon({ ...editingCoupon, max_uses: e.target.value === '' ? null : parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-white/20 uppercase">Data de Expiração (Horário de Brasília)</p>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-white"
                                        value={editingCoupon.expires_at ? new Date(new Date(editingCoupon.expires_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                        onChange={e => setEditingCoupon({ ...editingCoupon, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingCoupon(null)} className="flex-1 py-3 bg-white/5 text-white/40 rounded-xl text-[9px] font-black uppercase">Cancelar</button>
                                <button onClick={saveCoupon} disabled={isSaving} className="flex-[2] py-3 bg-primary text-black rounded-xl font-black text-[9px] uppercase shadow-lg shadow-primary/20">{isSaving ? 'Salvando...' : 'Salvar Cupom'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCreatingCatalog && (
                <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl p-6 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="w-full max-w-[320px] bg-surface-dark border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
                        <div className="text-center space-y-1">
                            <h3 className="font-black uppercase italic tracking-widest text-sm text-primary">Novo Item no Backend</h3>
                            <p className="text-[10px] text-white/40">Isso cria o registro oficial no banco de dados.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-white/20 uppercase pl-1">Quantidade de BCOINS</p>
                                <input
                                    type="number"
                                    placeholder="Ex: 1760"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-lg font-black text-center text-white outline-none focus:border-primary/50 transition-all"
                                    value={newCatalogCoins}
                                    onChange={e => setNewCatalogCoins(parseInt(e.target.value) || '')}
                                    autoFocus
                                />
                            </div>

                            <div className="bg-white/5 rounded-xl p-3 space-y-1">
                                <p className="text-[8px] font-black text-white/20 uppercase">IDs Gerados (Visualização)</p>
                                <p className="text-[9px] font-mono text-white/60">ID: bcoins_pack_{newCatalogCoins || '0'}</p>
                                <p className="text-[9px] font-mono text-white/60">SKU: bcoins_{newCatalogCoins || '0'}</p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsCreatingCatalog(false)} className="flex-1 py-3 bg-white/5 text-white/40 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-all">Cancelar</button>
                                <button onClick={saveCatalogItem} disabled={isSaving || !newCatalogCoins} className="flex-[2] py-3 bg-primary text-black rounded-xl font-black text-[9px] uppercase shadow-lg shadow-primary/20 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all">
                                    {isSaving ? 'Criando...' : 'Criar e Vincular'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
