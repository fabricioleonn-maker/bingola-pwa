import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Message } from './types';

interface ChatStore {
    roomMessages: Message[];
    directMessages: Record<string, Message[]>; // friendId -> messages

    subscribeToRoom: (roomId: string) => () => void;
    sendMessageToRoom: (roomId: string, content: string) => Promise<void>;

    sendDirectMessage: (receiverId: string, content) => Promise<void>;
    fetchDirectMessages: (friendId: string) => Promise<void>;
    subscribeToDirectMessages: (friendId: string) => () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
    roomMessages: [],
    directMessages: {},

    subscribeToRoom: (roomId: string) => {
        const fetchExisting = async () => {
            const { data } = await supabase
                .from('room_messages')
                .select('*, profiles(username, avatar_url)')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })
                .limit(50);
            if (data) set({ roomMessages: data as any });
        };
        fetchExisting();

        const channel = supabase
            .channel(`chat_room_${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_messages',
                filter: `room_id=eq.${roomId}`
            }, async (payload) => {
                // Fetch profile for the new message
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', payload.new.user_id)
                    .single();

                const newMessage = { ...payload.new, profiles: profile } as any;
                set(state => {
                    // Avoid duplicates
                    if (state.roomMessages.some(m => m.id === newMessage.id)) return state;
                    return { roomMessages: [...state.roomMessages, newMessage] };
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            set({ roomMessages: [] });
        };
    },

    sendMessageToRoom: async (roomId, content) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('room_messages').insert({
            room_id: roomId,
            user_id: user.id,
            content
        });
    },

    sendDirectMessage: async (receiverId, content) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic update would be nice, but let's stick to delivery first
        const { data: newMessage, error } = await supabase.from('direct_messages').insert({
            sender_id: user.id,
            receiver_id: receiverId,
            content
        }).select('*, profiles:sender_id(username, avatar_url)').single();

        if (error) {
            console.error("[Chat] Send DM error:", error);
            return;
        }

        if (newMessage) {
            set(state => {
                const list = state.directMessages[receiverId] || [];
                if (list.some(m => m.id === (newMessage as any).id)) return state;
                return {
                    directMessages: {
                        ...state.directMessages,
                        [receiverId]: [...list, newMessage as any]
                    }
                };
            });
        }
    },

    fetchDirectMessages: async (friendId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('direct_messages')
            .select('*, profiles:sender_id(username, avatar_url)')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (data) {
            set(state => ({
                directMessages: {
                    ...state.directMessages,
                    [friendId]: data as any
                }
            }));
        }
    },

    subscribeToDirectMessages: (friendId: string) => {
        const channel = supabase
            .channel(`dm_${friendId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages'
            }, async (payload) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const msg = payload.new;
                // Only care if it's relevant to this chat
                const isRelevant = (msg.sender_id === user.id && msg.receiver_id === friendId) ||
                    (msg.sender_id === friendId && msg.receiver_id === user.id);

                if (isRelevant) {
                    // Fetch profile if it's from the friend
                    let profile = null;
                    if (msg.sender_id === friendId) {
                        const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', friendId).single();
                        profile = data;
                    }

                    const newMessage = { ...msg, profiles: profile };
                    set(state => {
                        const list = state.directMessages[friendId] || [];
                        if (list.some(m => m.id === (newMessage as any).id)) return state;
                        return {
                            directMessages: {
                                ...state.directMessages,
                                [friendId]: [...list, newMessage as any]
                            }
                        };
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}));
