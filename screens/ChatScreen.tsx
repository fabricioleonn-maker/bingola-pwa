import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../state/chatStore';
import { useRoomStore } from '../state/roomStore';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { useFriendshipStore } from '../state/friendshipStore';

interface Props {
  onBack: () => void;
}

export const ChatScreen: React.FC<Props> = ({ onBack }) => {
  const [msg, setMsg] = useState('');
  const roomId = useRoomStore(s => s.roomId);
  const room = useRoomStore(s => s.room);
  const acceptedList = useRoomStore(s => s.accepted);
  const messages = useChatStore(s => s.roomMessages);
  const subscribe = useChatStore(s => s.subscribeToRoom);
  const sendMessage = useChatStore(s => s.sendMessageToRoom);
  const directMessages = useChatStore(s => s.directMessages);
  const sendDM = useChatStore(s => s.sendDirectMessage);

  const [activeTab, setActiveTab] = useState<'table' | 'private'>('table');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  const fetchConversations = useChatStore(s => s.fetchConversations);
  const subscribeDMs = useChatStore(s => s.subscribeToDirectMessages);
  const fetchDMs = useChatStore(s => s.fetchDirectMessages);
  const friends = useFriendshipStore(s => s.friends);

  useEffect(() => {
    // 1. Fetch all historical conversations
    fetchConversations().then(data => {
      setConversations(data);
      // 2. Subscribe and fetch messages for EACH partner
      data.forEach(p => {
        fetchDMs(p.id);
        subscribeDMs(p.id);
      });
    });

    // Also keep friends for context if needed, but primary list is conversations
  }, [fetchConversations, fetchDMs, subscribeDMs]);

  useEffect(() => {
    if (activeTab === 'private') {
      fetchConversations().then(setConversations);
    }
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (roomId) {
      const unsubscribe = subscribe(roomId);
      return () => unsubscribe();
    }
  }, [roomId, subscribe]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        // Use setTimeout to ensure DOM is fully updated (especially for images or layout shifts)
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    };

    scrollToBottom();
  }, [messages.length, directMessages, selectedFriendId, activeTab]);

  const handleSend = async () => {
    if (!msg.trim()) return;
    if (activeTab === 'table') {
      if (!roomId) return;
      await sendMessage(roomId, msg);
    } else {
      if (!selectedFriendId) {
        useNotificationStore.getState().show("Selecione um amigo na lista para enviar mensagem.", 'info');
        return;
      }
      await sendDM(selectedFriendId, msg);
    }
    setMsg('');
  };

  return (
    <div className="bg-background-dark text-white min-h-[100dvh] flex flex-col font-sans pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-50 bg-background-dark/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button onClick={onBack} className="text-white flex size-12 items-center justify-start">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-lg font-bold italic uppercase tracking-tighter">Chat da Mesa</h2>
            <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="size-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,61,113,0.8)]"></span>
              {acceptedList.length + (room?.host_id ? 1 : 0)} Jogando
            </span>
          </div>
          <button className="size-12 flex items-center justify-end text-white/20">
            <span className="material-symbols-outlined">info</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-4 py-3 flex gap-2">
          <button
            onClick={() => { setActiveTab('table'); setSelectedFriendId(null); }}
            className={`flex-1 py-8 rounded-3xl flex flex-col items-center justify-center gap-1 border transition-all ${activeTab === 'table' ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 opacity-40'}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Mesa Atual</span>
            <p className="text-lg font-bold italic uppercase truncate px-2 w-full text-center">
              {room?.name || 'Mesa'}
            </p>
          </button>

          <button
            onClick={() => setActiveTab('private')}
            className={`flex-1 py-8 rounded-3xl flex flex-col items-center justify-center gap-1 border transition-all ${activeTab === 'private' ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 opacity-40'}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Conversas</span>
            <p className="text-lg font-bold italic uppercase">Privadas</p>
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 w-full">
        {activeTab === 'table' ? (
          <>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 opacity-20">
                <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Silêncio na mesa...</p>
              </div>
            )}

            {messages.map((m: any, i) => {
              const isMe = m.user_id === currentUserId;
              return (
                <div key={m.id || i} className={`flex items-end gap-3 ${isMe ? 'justify-end' : ''}`}>
                  {!isMe && (
                    <img src={m.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-8 rounded-full border border-white/10" />
                  )}
                  <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider ml-1">{m.profiles?.username || 'Jogador'}</p>}
                    <div className={`max-w-[240px] px-4 py-3 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-none'}`}>
                      <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                  {isMe && (
                    <img src={m.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-8 rounded-full border border-primary/30" />
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="w-full">
            {!selectedFriendId ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 ml-1">Conversas Recentes</p>
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 opacity-20">
                    <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Nenhuma conversa...</p>
                  </div>
                ) : (
                  conversations.map(p => {
                    const friendMessages = directMessages[p.id] || [];
                    const lastMsg = friendMessages[friendMessages.length - 1];
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedFriendId(p.id)}
                        className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4 active:bg-white/10 transition-all text-left"
                      >
                        <img src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-12 rounded-full border border-white/10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold truncate tracking-tight">{p.username}</p>
                          <p className="text-white/40 text-xs truncate">
                            {lastMsg ? lastMsg.content : 'Clique para ver as mensagens'}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-white/20 text-sm">chevron_right</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <button onClick={() => setSelectedFriendId(null)} className="size-8 flex items-center justify-center bg-white/10 rounded-full text-white/60">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                  </button>
                  <img src={conversations.find(p => p.id === selectedFriendId)?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-8 rounded-full" />
                  <p className="font-bold text-sm">{conversations.find(p => p.id === selectedFriendId)?.username}</p>
                </div>

                {(directMessages[selectedFriendId] || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 opacity-20">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Diga um Oi!</p>
                  </div>
                ) : (
                  (directMessages[selectedFriendId] || []).map((m: any, i) => {
                    const isMe = m.sender_id === currentUserId;
                    const senderAvatar = m.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100';
                    const senderName = m.profiles?.username || 'Amigo';

                    return (
                      <div key={m.id || i} className={`flex items-end gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <img src={senderAvatar} className="size-8 rounded-full border border-white/10" />
                        )}
                        <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider ml-1">{senderName}</p>}
                          <div className={`max-w-[240px] px-4 py-3 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white/10 text-white/90 border border-white/10 rounded-bl-none'}`}>
                            <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                          </div>
                        </div>
                        {isMe && (
                          <img src={senderAvatar} className="size-8 rounded-full border border-primary/30" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-background-dark/95 backdrop-blur-md border-t border-white/5 p-4 pb-8 sticky bottom-0">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex justify-between px-2">
            {['🔥', '👏', '😂', '🍀', '🙌'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => setMsg(prev => prev + emoji)}
                className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl active:scale-90 transition-all shadow-inner"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-6 pr-1.5 py-1.5 focus-within:bg-white/[0.08] focus-within:border-primary/30 transition-all">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-white placeholder:text-white/20 font-medium"
              placeholder="Digite sua mensagem..."
            />
            <button
              onClick={handleSend}
              className="bg-primary text-white size-10 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
