
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';

interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: {
        username: string;
        avatar_url: string;
    };
}

interface Props {
    bottomOffset?: string;
}

export const FloatingChat: React.FC<Props> = ({ bottomOffset = '0px' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const roomId = useRoomStore(s => s.roomId);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const emojis = ['🍀', '🏁', '🎉', '🎱', '🔥', '👏', '🏆', '💎', '💰', '🙌'];

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) setCurrentUserId(data.user.id);
        });
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!roomId) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('room_messages')
                .select('*, profiles:user_id(username, avatar_url)')
                .eq('room_id', roomId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setMessages(data.reverse());
        };

        fetchMessages();

        const channel = supabase.channel(`room_chat:${roomId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
                async (payload) => {
                    // Deduplicate
                    const exists = messages.some(m => m.id === payload.new.id);
                    if (exists) return;

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    const fullMsg = { ...payload.new, profiles: profile } as Message;
                    setMessages(prev => {
                        if (prev.some(m => m.id === fullMsg.id)) return prev;
                        return [...prev, fullMsg];
                    });

                    if (!isExpanded) setUnreadCount(c => c + 1);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [roomId, isExpanded]);

    useEffect(() => {
        if (isExpanded) {
            setUnreadCount(0);
            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    }, [isExpanded, messages.length]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !roomId || !currentUserId) return;

        const content = newMessage.trim();
        setNewMessage('');
        setShowEmojis(false); // Close emojis on send

        try {
            const { error } = await supabase.from('room_messages').insert({
                room_id: roomId,
                user_id: currentUserId,
                content
            });
            if (error) throw error;
        } catch (err) {
            console.error("[Chat] Send error:", err);
        }
    };

    const addEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
    };

    if (!roomId) return null;

    return (
        <div
            style={{ bottom: isExpanded ? '0px' : bottomOffset }}
            className={`fixed left-0 right-0 z-[100] flex flex-col items-center transition-all duration-500 ease-in-out ${isExpanded ? 'h-[60vh] bg-background-dark/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]' : 'h-12 bg-white/5 hover:bg-white/10'}`}
        >
            {/* Handle/Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full h-12 flex-none flex items-center justify-between px-6 cursor-pointer group relative overflow-hidden"
            >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500" />

                <div className="flex items-center gap-3 relative z-10">
                    <div className="relative">
                        <span className={`material-symbols-outlined text-primary ${unreadCount > 0 ? 'animate-bounce' : ''}`}>
                            {unreadCount > 0 ? 'mark_chat_unread' : 'chat'}
                        </span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full border border-background-dark animate-pulse" />
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                        Chat da Mesa {unreadCount > 0 && <span className="text-primary">({unreadCount})</span>}
                    </span>
                </div>

                <div className="flex-1 flex justify-center relative z-10 mr-4">
                    <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-1 rounded-full bg-white/20 transition-all group-hover:bg-primary/50 group-hover:w-12 ${isExpanded ? 'rotate-[10deg] translate-x-1' : ''}`} />
                        <div className={`w-8 h-1 rounded-full bg-white/10 transition-all group-hover:bg-primary/30 group-hover:w-12 ${isExpanded ? 'rotate-[-10deg] -translate-x-1' : ''}`} />
                    </div>
                </div>

                <span className="material-symbols-outlined text-white/20 text-lg transition-transform duration-500 relative z-10" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    keyboard_arrow_up
                </span>
            </div>

            {/* Content */}
            <div className={`w-full max-w-[430px] flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 italic text-[10px] uppercase tracking-widest">
                            <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                            Nenhuma mensagem ainda
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isMe = msg.user_id === currentUserId;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {!isMe && <img src={msg.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} className="size-4 rounded-full" />}
                                    <span className="text-[9px] font-black text-white/30 uppercase tracking-tighter">
                                        {isMe ? 'VOCÊ' : msg.profiles?.username || 'JOGADOR'}
                                    </span>
                                </div>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10' : 'bg-white/5 text-white/80 rounded-tl-none border border-white/5'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col bg-white/5 border-t border-white/5">
                    {/* Emoji Bar */}
                    {showEmojis && (
                        <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-300">
                            {emojis.map(e => (
                                <button
                                    key={e}
                                    type="button"
                                    onClick={() => addEmoji(e)}
                                    className="size-10 flex-none bg-white/5 rounded-xl flex items-center justify-center text-xl hover:bg-primary/20 transition-all active:scale-90"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSend} className="p-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowEmojis(!showEmojis)}
                            className={`size-12 rounded-xl flex items-center justify-center transition-all ${showEmojis ? 'bg-primary text-white' : 'bg-white/5 text-white/40 border border-white/5'}`}
                        >
                            <span className="material-symbols-outlined">{showEmojis ? 'close' : 'mood'}</span>
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escreva sua mensagem..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all"
                        />
                        <button type="submit" className="size-12 bg-primary text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
