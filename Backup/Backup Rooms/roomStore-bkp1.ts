import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Room, Participant } from './types';
import { persistRoomId } from './persist';

type RealtimeState = 'IDLE' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'ERROR';

type RoomStore = {
    roomId: string | null;
    room: Room | null;

    // participantes
    pending: Participant[];
    accepted: Participant[];

    // conexão
    realtime: RealtimeState;
    lastError: string | null;

    // Polling support
    pollingInterval: number | null;

    // actions
    setRoomId: (id: string | null) => void;
    // compat: App.tsx calls setActiveRoom
    setActiveRoom: (id: string | null) => void;
    bootstrap: (roomId: string) => Promise<void>;
    subscribe: (roomId: string) => () => void;

    refreshParticipants: (roomId: string) => Promise<void>;
    approve: (participantId: string) => Promise<void>;
    reject: (participantId: string) => Promise<void>;

    hardExit: (roomId: string, userId: string) => Promise<void>;

    startPolling: (roomId: string) => void;
    stopPolling: () => void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
    roomId: null,
    room: null,
    pending: [],
    accepted: [],
    realtime: 'IDLE',
    lastError: null,
    pollingInterval: null,

    setRoomId: (id) => {
        persistRoomId(id);
        set({ roomId: id });
    },

    // compat: keep older API used by App.tsx
    setActiveRoom: (id) => {
        // delegate to canonical setter
        get().setRoomId(id);
    },

    bootstrap: async (roomId) => {
        set({ lastError: null });

        const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();

        if (roomErr || !room) {
            set({ room: null, pending: [], accepted: [], lastError: roomErr?.message ?? 'room not found' });
            return;
        }

        // normalize drawn_numbers (jsonb pode vir null/obj)
        const drawn = Array.isArray(room.drawn_numbers) ? room.drawn_numbers : [];
        set({ room: { ...room, drawn_numbers: drawn } });

        await get().refreshParticipants(roomId);
    },

    refreshParticipants: async (roomId) => {
        const { data, error } = await supabase
            .from('participants')
            .select('*, profiles(username, avatar_url, level, bcoins)')
            .eq('room_id', roomId)
            .in('status', ['pending', 'accepted']);

        if (error) {
            set({ lastError: error.message });
            return;
        }

        const pending = (data ?? []).filter(p => p.status === 'pending');
        const accepted = (data ?? []).filter(p => p.status === 'accepted');
        set({ pending, accepted });
    },

    subscribe: (roomId) => {
        // sempre remove canal anterior se existir
        set({ realtime: 'SUBSCRIBING', lastError: null });

        const channel = supabase
            .channel(`room_${roomId}`)
            // rooms changes (drawn_numbers / status / updated_at)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
                const current = get().room;
                if (!payload.new) return;
                const newRoom: any = payload.new;
                const drawn = Array.isArray(newRoom.drawn_numbers) ? newRoom.drawn_numbers : [];
                set({ room: { ...(current ?? newRoom), ...newRoom, drawn_numbers: drawn } });
            })
            // participants changes (pending/accepted)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, () => {
                // Não confie no payload; faça refresh determinístico
                get().refreshParticipants(roomId);
            })
            .subscribe((status) => {
                console.log(`[Realtime] Room ${roomId} status:`, status);
                if (status === 'SUBSCRIBED') {
                    set({ realtime: 'SUBSCRIBED' });
                    get().stopPolling();
                }
                if (status === 'CHANNEL_ERROR') {
                    set({ realtime: 'ERROR', lastError: 'CHANNEL_ERROR' });
                    get().startPolling(roomId);
                }
                if (status === 'CLOSED') {
                    set({ realtime: 'IDLE' });
                }
            });

        // cleanup
        return () => {
            supabase.removeChannel(channel);
            get().stopPolling();
            set({ realtime: 'IDLE' });
        };
    },

    approve: async (participantId) => {
        const pending = get().pending;
        const target = pending.find(p => p.id === participantId);
        if (target) {
            set({
                pending: pending.filter(p => p.id !== participantId),
                accepted: [...get().accepted, { ...target, status: 'accepted' }],
            });
        }

        const { error } = await supabase
            .from('participants')
            .update({ status: 'accepted' })
            .eq('id', participantId);

        if (error) {
            const roomId = get().roomId;
            if (roomId) await get().refreshParticipants(roomId);
            set({ lastError: error.message });
        }
    },

    reject: async (participantId) => {
        set({ pending: get().pending.filter(p => p.id !== participantId) });

        const { error } = await supabase
            .from('participants')
            .update({ status: 'rejected' })
            .eq('id', participantId);

        if (error) {
            const roomId = get().roomId;
            if (roomId) await get().refreshParticipants(roomId);
            set({ lastError: error.message });
        }
    },

    hardExit: async (roomId, userId) => {
        const { error } = await supabase
            .from('participants')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', userId);

        if (error) set({ lastError: error.message });
    },

    startPolling: (roomId) => {
        if (get().pollingInterval) return;
        console.warn(`[Polling] Starting fallback for room ${roomId}`);
        const interval = window.setInterval(() => {
            get().refreshParticipants(roomId);
            // Also refresh room for drawn_numbers and status
            const { room } = get();
            if (room) {
                supabase.from('rooms').select('*').eq('id', roomId).single().then(({ data }) => {
                    if (data) {
                        const drawn = Array.isArray(data.drawn_numbers) ? data.drawn_numbers : [];
                        set({ room: { ...data, drawn_numbers: drawn } });
                    }
                });
            }
        }, 3000);
        set({ pollingInterval: interval });
    },

    stopPolling: () => {
        if (get().pollingInterval) {
            clearInterval(get().pollingInterval);
            set({ pollingInterval: null });
        }
    }
}));
