import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Room, Participant } from './types';
import { persistRoomId } from './persist';

function accumulateDrawnNumbers(current: number[], incoming: number[]) {
  if (!Array.isArray(incoming)) return current;

  // 1. Reset Detection: If incoming is empty, it's a reset (or new round).
  // We trust checks upstream (Round ID etc), but generally if incoming is empty, 
  // we should clear. 
  if (incoming.length === 0) return incoming;

  // 2. Stale Poll Protection: If incoming is a SUBSET of current (and current has more data),
  // it means we have data that the incoming source (e.g. slow DB replica) hasn't seen yet.
  // We keep our current, richer state.
  // Exception: If it's a "New Game" that happens to reuse numbers? (Handled by empty reset usually)
  const isSubset = incoming.every(n => current.includes(n));
  if (isSubset && current.length > incoming.length) {
    return current;
  }

  // 3. Normal Merge: Add any new numbers from incoming to current
  // Use Set to ensure uniqueness and order (append new ones)
  // Converting to Set interacts with order. 
  // We want to preserve CURRENT order and append INCOMING new ones?
  // Actually, standard Bingo order is "drawn sequence".
  // If Incoming and Current differ in order, Set iteration might be weird.
  // Safer: Union
  return Array.from(new Set([...current, ...incoming]));
}

type RealtimeState = 'IDLE' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'ERROR';

type RoomStore = {
  roomId: string | null;
  room: Room | null;

  pending: Participant[];
  accepted: Participant[];

  realtime: RealtimeState;
  lastError: string | null;

  // Realtime channel tracking
  channel: any | null;
  subscribedRoomId: string | null;

  // Polling fallback
  pollingInterval: number | null;
  pollingRoomId: string | null;

  // Heartbeat (presença)
  heartbeatInterval: number | null;
  heartbeatRoomId: string | null;

  // Cleanup stale (rodado pelo host/master)
  cleanupInterval: number | null;
  cleanupRoomId: string | null;

  inFlight: Record<string, boolean>;

  setRoomId: (id: string | null) => void;

  bootstrap: (roomId: string) => Promise<void>;
  subscribe: (roomId: string) => () => void;

  refreshParticipants: (roomId: string) => Promise<void>;

  approve: (participantId: string) => Promise<void>;
  reject: (participantId: string) => Promise<void>;

  hardExit: (roomId: string, userId: string) => Promise<void>;

  startPolling: (roomId: string, ms?: number) => void;
  stopPolling: () => void;

  startHeartbeat: (roomId: string) => void;
  stopHeartbeat: () => void;

  startCleanupStale: (roomId: string) => void;
  stopCleanupStale: () => void;

  _cleanupSubscription: () => void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomId: null,
  room: null,
  pending: [],
  accepted: [],
  realtime: 'IDLE',
  lastError: null,

  channel: null,
  subscribedRoomId: null,

  pollingInterval: null,
  pollingRoomId: null,

  heartbeatInterval: null,
  heartbeatRoomId: null,

  cleanupInterval: null,
  cleanupRoomId: null,

  inFlight: {},

  _cleanupSubscription: () => {
    const { channel } = get();

    // PARA tudo que pode “reviver” state
    get().stopPolling();
    get().stopHeartbeat();
    get().stopCleanupStale();

    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }

    set({
      channel: null,
      subscribedRoomId: null,
      realtime: 'IDLE',
    });
  },

  setRoomId: (id) => {
    persistRoomId(id);

    const prev = get().roomId;

    // Troca de sala ou saída: cleanup idempotente + zera dados
    if (prev && prev !== id) {
      get()._cleanupSubscription();
      set({
        room: null,
        pending: [],
        accepted: [],
        lastError: null,
        inFlight: {},
      });
    }

    if (!id && prev) {
      get()._cleanupSubscription();
      set({
        room: null,
        pending: [],
        accepted: [],
        lastError: null,
        inFlight: {},
      });
    }

    set({ roomId: id });
  },

  bootstrap: async (roomId) => {
    set({ lastError: null });

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    // Guard: se o user mudou de sala no meio
    if (get().roomId && get().roomId !== roomId) return;

    if (roomErr || !room) {
      set({
        room: null,
        pending: [],
        accepted: [],
        lastError: roomErr?.message ?? 'room not found',
      });
      return;
    }

    const drawn = Array.isArray((room as any).drawn_numbers) ? (room as any).drawn_numbers : [];
    set({ room: { ...(room as any), drawn_numbers: drawn } });

    await get().refreshParticipants(roomId);
  },

  refreshParticipants: async (roomId) => {
    // 1. Participantes
    const { data, error } = await supabase
      .from('participants')
      .select('*, profiles(username, avatar_url, level, bcoins)')
      .eq('room_id', roomId)
      .in('status', ['pending', 'accepted']);

    // Guard: se mudou de sala no meio
    if (get().roomId && get().roomId !== roomId && get().subscribedRoomId !== roomId) return;

    if (error) {
      set({ lastError: error.message });
      return;
    }

    const pending = (data ?? []).filter((p: any) => p.status === 'pending');
    const accepted = (data ?? []).filter((p: any) => p.status === 'accepted');
    set({ pending, accepted });

    // 2. Refresh rápido no status da sala
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomData && (get().roomId === roomId || get().subscribedRoomId === roomId)) {
      const incomingDrawn = Array.isArray((roomData as any).drawn_numbers) ? (roomData as any).drawn_numbers : [];

      const current = get().room;
      const currentDrawn = current?.drawn_numbers || [];
      const mergedDrawn = accumulateDrawnNumbers(currentDrawn, incomingDrawn);

      set({ room: { ...(roomData as any), drawn_numbers: mergedDrawn } });
    }
  },

  subscribe: (roomId) => {
    // garante 1 canal por vez
    get()._cleanupSubscription();

    set({
      realtime: 'SUBSCRIBING',
      lastError: null,
      subscribedRoomId: roomId,
    });

    const channel = supabase
      .channel(`room_${roomId}`)

      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (get().subscribedRoomId !== roomId) return;
          if (!payload.new) return;

          const current = get().room;
          const newRoom: any = payload.new;

          const incomingDrawn = Array.isArray(newRoom.drawn_numbers) ? newRoom.drawn_numbers : [];
          const currentDrawn = current?.drawn_numbers || [];
          const mergedDrawn = accumulateDrawnNumbers(currentDrawn, incomingDrawn);

          set({ room: { ...current, ...newRoom, drawn_numbers: mergedDrawn } });
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => {
          if (get().subscribedRoomId !== roomId) return;
          get().refreshParticipants(roomId);
        }
      )

      .subscribe((status) => {
        // Guard
        if (get().subscribedRoomId !== roomId) return;

        console.log(`[Realtime] Room ${roomId} status:`, status);

        if (status === 'SUBSCRIBED') {
          set({ realtime: 'SUBSCRIBED' });

          // Polling "lento" de segurança (12s) enquanto Realtime está OK
          get().stopPolling();
          get().startPolling(roomId, 12000);

          get().startHeartbeat(roomId);
          get().startCleanupStale(roomId);
        }

        if (status === 'CHANNEL_ERROR') {
          set({ realtime: 'ERROR', lastError: 'CHANNEL_ERROR' });
          get().startPolling(roomId, 3000);
        }

        if (status === 'CLOSED') {
          set({ realtime: 'IDLE' });
          get().startPolling(roomId, 3000);
        }
      });

    set({ channel });

    return () => {
      const current = get().channel;
      if (current === channel) {
        get()._cleanupSubscription();
      } else {
        try {
          supabase.removeChannel(channel);
        } catch { /* ignore */ }
      }
    };
  },

  startHeartbeat: (roomId) => {
    if (get().heartbeatInterval && get().heartbeatRoomId !== roomId) {
      get().stopHeartbeat();
    }
    if (get().heartbeatInterval) return;

    const interval = window.setInterval(async () => {
      if (get().roomId !== roomId && get().subscribedRoomId !== roomId) return;
      const { error } = await supabase.rpc('touch_participant', { p_room_id: roomId });
      if (error) console.warn('[Heartbeat] error:', error.message);
    }, 10_000);

    set({ heartbeatInterval: interval, heartbeatRoomId: roomId });
  },

  stopHeartbeat: () => {
    const id = get().heartbeatInterval;
    if (id) {
      clearInterval(id);
      set({ heartbeatInterval: null, heartbeatRoomId: null });
    }
  },

  startCleanupStale: (roomId) => {
    if (get().cleanupInterval && get().cleanupRoomId !== roomId) {
      get().stopCleanupStale();
    }
    if (get().cleanupInterval) return;

    const interval = window.setInterval(async () => {
      if (get().roomId !== roomId && get().subscribedRoomId !== roomId) return;
      await supabase.rpc('cleanup_stale_participants', { p_room_id: roomId });
    }, 45_000);

    set({ cleanupInterval: interval, cleanupRoomId: roomId });
  },

  stopCleanupStale: () => {
    const id = get().cleanupInterval;
    if (id) {
      clearInterval(id);
      set({ cleanupInterval: null, cleanupRoomId: null });
    }
  },

  startPolling: (roomId, ms = 3000) => {
    if (get().pollingInterval && get().pollingRoomId !== roomId) {
      get().stopPolling();
    }
    if (get().pollingInterval) return;

    const interval = window.setInterval(() => {
      if (get().roomId !== roomId && get().subscribedRoomId !== roomId) return;
      get().refreshParticipants(roomId);
    }, ms);

    set({ pollingInterval: interval, pollingRoomId: roomId });
  },

  stopPolling: () => {
    const id = get().pollingInterval;
    if (id) {
      clearInterval(id);
      set({ pollingInterval: null, pollingRoomId: null });
    }
  },

  approve: async (participantId) => {
    if (get().inFlight[participantId]) return;
    set({ inFlight: { ...get().inFlight, [participantId]: true } });

    try {
      const { error } = await supabase
        .from('participants')
        .update({ status: 'accepted' })
        .eq('id', participantId);
      if (error) throw error;

      await get().refreshParticipants(get().roomId!);
    } catch {
      // fallback
    } finally {
      set({ inFlight: { ...get().inFlight, [participantId]: false } });
    }
  },

  reject: async (participantId) => {
    if (get().inFlight[participantId]) return;
    set({ inFlight: { ...get().inFlight, [participantId]: true } });

    try {
      const { error } = await supabase
        .from('participants')
        .update({ status: 'rejected' })
        .eq('id', participantId);
      if (error) throw error;

      await get().refreshParticipants(get().roomId!);
    } catch {
      // fallback
    } finally {
      set({ inFlight: { ...get().inFlight, [participantId]: false } });
    }
  },

  hardExit: async (roomId, userId) => {
    get()._cleanupSubscription();
    await supabase.from('participants').delete().eq('room_id', roomId).eq('user_id', userId);
    set({ roomId: null, room: null, pending: [], accepted: [] });
  },
}));
