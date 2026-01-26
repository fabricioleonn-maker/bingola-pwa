import React, { useEffect, useState, useRef } from 'react';
import { useFriendshipStore } from '../state/friendshipStore';
import { useNotificationStore } from '../state/notificationStore';
import { supabase } from '../lib/supabase';

import { AppScreen } from '../types';

interface Props {
    onBack: () => void;
    onNavigate: (screen: AppScreen) => void;
}

import { useChatStore } from '../state/chatStore';

interface Props {
    onBack: () => void;
    onNavigate: (screen: AppScreen) => void;
}

export const SocialScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
    const { friends, pendingIncoming, pendingOutgoing, fetchFriends, searchUsers, sendRequest, acceptRequest, rejectRequest, removeFriend } = useFriendshipStore();
    const { directMessages, sendDirectMessage, fetchDirectMessages } = useChatStore();

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'search' | 'messages'>('messages');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [dmContent, setDmContent] = useState('');

    useEffect(() => {
        fetchFriends().finally(() => setLoading(false));
        const unsubscribe = useFriendshipStore.getState().subscribe();
        return () => unsubscribe();
    }, [fetchFriends]);

    const handleSearch = async (q: string) => {
        setSearchQuery(q);
        if (q.length > 2) {
            setSearching(true);
            const r = await searchUsers(q);
            setSearchResults(r);
            setSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const handleAddFriend = async (userId: string) => {
        await sendRequest(userId);
        useNotificationStore.getState().show("Convite enviado!", 'success');
        setSearchResults(prev => prev.filter(u => u.id !== userId));
    };

    const handleAccept = async (id: string) => {
        await acceptRequest(id);
        useNotificationStore.getState().show("Pedido aceito!", 'success');
    };

    const handleReject = async (id: string) => {
        await rejectRequest(id);
        useNotificationStore.getState().show("Pedido recusado.", 'info');
    };

    const handleRemove = async (friendId: string) => {
        useNotificationStore.getState().confirm({
            title: "Remover Amigo?",
            message: "Tem certeza que deseja desfazer esta amizade?",
            onConfirm: async () => {
                await removeFriend(friendId);
                useNotificationStore.getState().show("Amigo removido.", 'info');
            }
        });
    };

    const subscribeToDMs = useChatStore(s => s.subscribeToDirectMessages);
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [directMessages, selectedChat]);

    const openChat = async (friend: any) => {
        setSelectedChat(friend);
        setActiveTab('messages');
        const friendId = friend.friend_id || friend.id;
        await fetchDirectMessages(friendId);
        const unsubscribe = subscribeToDMs(friendId);
        (window as any)._latest_dm_unsubscribe = unsubscribe;
    };

    // Cleanup subscription when closing chat or switching tabs
    useEffect(() => {
        if (activeTab !== 'messages' && (window as any)._latest_dm_unsubscribe) {
            (window as any)._latest_dm_unsubscribe();
            (window as any)._latest_dm_unsubscribe = null;
        }
    }, [activeTab]);

    const handleSendDM = async () => {
        if (!dmContent.trim() || !selectedChat) return;
        await sendDirectMessage(selectedChat.friend_id || selectedChat.id, dmContent);
        setDmContent('');
    };

    return (
        <div className="min-h-[100dvh] bg-background-dark text-white font-sans flex flex-col pb-[env(safe-area-inset-bottom)]">
            <header className="sticky top-0 z-50 bg-background-dark/90 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <button onClick={onBack} className="size-12 flex items-center justify-start text-white">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-black italic uppercase tracking-tighter">Social</h2>
                    <button onClick={() => setActiveTab('search')} className="size-12 flex items-center justify-end text-primary">
                        <span className="material-symbols-outlined">person_add</span>
                    </button>
                </div>

                <div className="max-w-md mx-auto mt-6 flex gap-1 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { id: 'messages', label: 'Mensagens' },
                        { id: 'friends', label: 'Amigos', count: friends.length },
                        { id: 'pending', label: 'Pedidos', count: pendingIncoming.length },
                        { id: 'search', label: 'Busca' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-none h-10 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-white/40 border border-white/5'}`}
                        >
                            {tab.label} {tab.count !== undefined && `(${tab.count})`}
                            {tab.id === 'pending' && pendingIncoming.length > 0 && (
                                <span className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] border-2 border-background-dark animate-bounce">
                                    {pendingIncoming.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full p-6 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-40">
                        <div className="size-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando conexões...</p>
                    </div>
                ) : activeTab === 'friends' ? (
                    <div className="space-y-4">
                        {friends.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-center opacity-20">
                                <span className="material-symbols-outlined text-6xl mb-4">person_off</span>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ninguém por aqui ainda.</p>
                                <button onClick={() => setActiveTab('search')} className="mt-4 text-primary text-[10px] font-black uppercase">Encontrar pessoas</button>
                            </div>
                        )}
                        {friends.map((f: any) => (
                            <div key={f.id} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/[0.08] transition-all group">
                                <div className="relative">
                                    <img src={f.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-14 rounded-full border-2 border-white/10" />
                                    <div className="absolute -bottom-1 -right-1 size-4 bg-green-500 rounded-full border-2 border-background-dark"></div>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black italic text-lg leading-tight">{f.friend_profiles?.username || 'Amigo'}</h4>
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Online Agora</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openChat(f)} className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-primary border border-white/10 active:scale-90 transition-all">
                                        <span className="material-symbols-outlined text-[20px]">chat</span>
                                    </button>
                                    <button onClick={() => handleRemove(f.friend_id)} className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-red-500/40 border border-white/10 active:scale-90 transition-all">
                                        <span className="material-symbols-outlined text-[20px]">person_remove</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'search' ? (
                    <div className="space-y-6">
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Buscar por @username..."
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 font-bold outline-none focus:border-primary/50 transition-all pr-12"
                            />
                            {searching ? (
                                <div className="absolute right-4 top-4 size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-symbols-outlined absolute right-4 top-4 text-white/20">search</span>
                            )}
                        </div>

                        <div className="space-y-3">
                            {searchResults.map(u => (
                                <div key={u.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4">
                                    <img src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-12 rounded-full" />
                                    <div className="flex-1">
                                        <h4 className="font-black italic text-base">@{u.username}</h4>
                                    </div>
                                    <button onClick={() => handleAddFriend(u.id)} className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl">Adicionar</button>
                                </div>
                            ))}
                            {searchQuery.length > 2 && searchResults.length === 0 && !searching && (
                                <p className="text-center py-10 text-[10px] text-white/20 uppercase font-black">Nenhum jogador encontrado com este nome.</p>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'messages' && selectedChat ? (
                    <div className="flex flex-col h-[60vh]">
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-3xl mb-4">
                            <img src={selectedChat.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-10 rounded-full" />
                            <div className="flex-1">
                                <h4 className="font-black italic text-sm">@{selectedChat.friend_profiles?.username}</h4>
                                <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">Chat Privado</p>
                            </div>
                            <button onClick={() => setSelectedChat(null)} className="size-8 rounded-full bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white/20 text-xl">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 p-2 mb-4 no-scrollbar">
                            {(directMessages[selectedChat.friend_id || selectedChat.id] || []).map((m: any, idx: number) => {
                                const isMe = m.sender_id !== (selectedChat.friend_id || selectedChat.id);
                                return (
                                    <div key={idx} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {!isMe && (
                                            <img
                                                src={selectedChat.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'}
                                                className="size-6 rounded-full border border-white/10 mb-1"
                                            />
                                        )}
                                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none'}`}>
                                            {m.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="relative">
                            <input
                                value={dmContent}
                                onChange={(e) => setDmContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendDM()}
                                placeholder="Digite uma mensagem..."
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-14 font-bold outline-none"
                            />
                            <button onClick={handleSendDM} className="absolute right-2 top-2 size-10 bg-primary rounded-xl flex items-center justify-center text-white">
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'messages' ? (
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-2">Suas Conversas</h3>
                        {friends.map((f: any) => (
                            <div key={f.id} onClick={() => openChat(f)} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4 active:bg-white/10 transition-all cursor-pointer">
                                <img src={f.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-12 rounded-full" />
                                <div className="flex-1">
                                    <h4 className="font-black italic text-base">@{f.friend_profiles?.username}</h4>
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Toque para conversar</p>
                                </div>
                                <span className="material-symbols-outlined text-white/20">chevron_right</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 ml-2">Recebidos</h3>
                            {pendingIncoming.length === 0 && <p className="text-[10px] text-white/20 ml-2 italic">Nenhum pedido pendente.</p>}
                            {pendingIncoming.map((f: any) => (
                                <div key={f.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4">
                                    <img src={f.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-12 rounded-full" />
                                    <div className="flex-1">
                                        <h4 className="font-black italic text-base">{f.friend_profiles?.username}</h4>
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Quer ser seu amigo</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAccept(f.id)} className="size-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                            <span className="material-symbols-outlined">check</span>
                                        </button>
                                        <button onClick={() => handleReject(f.id)} className="size-10 bg-white/5 text-white/40 rounded-xl flex items-center justify-center border border-white/5">
                                            <span className="material-symbols-outlined text-[20px]">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-2">Enviados</h3>
                            {pendingOutgoing.map((f: any) => (
                                <div key={f.id} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4 opacity-70">
                                    <img src={f.friend_profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-12 rounded-full grayscale" />
                                    <div className="flex-1">
                                        <h4 className="font-black italic text-base">{f.friend_profiles?.username}</h4>
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Aguardando resposta...</p>
                                    </div>
                                    <button onClick={() => handleReject(f.id)} className="text-[9px] font-black text-primary uppercase tracking-widest px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">Cancelar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-3 px-6 z-50">
                <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-1 text-white/40">
                    <span className="material-symbols-outlined">home</span>
                    <span className="text-[10px] font-bold">Início</span>
                </button>
                <button onClick={() => onNavigate('ranking')} className="flex flex-col items-center gap-1 text-white/40">
                    <span className="material-symbols-outlined">leaderboard</span>
                    <span className="text-[10px] font-bold">Ranking</span>
                </button>
                <button onClick={() => onNavigate('friends')} className="flex flex-col items-center gap-1 text-primary">
                    <span className="material-symbols-outlined fill-1">group</span>
                    <span className="text-[10px] font-bold">Social</span>
                </button>
                <button onClick={() => onNavigate('store')} className="flex flex-col items-center gap-1 text-white/40">
                    <span className="material-symbols-outlined">storefront</span>
                    <span className="text-[10px] font-bold">Loja</span>
                </button>
                <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-white/40">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[10px] font-bold">Perfil</span>
                </button>
            </nav>
        </div>
    );
};
