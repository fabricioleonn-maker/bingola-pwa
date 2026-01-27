import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';
import type { Room, Participant } from './types';
import { persistRoomId } from './persist';

function accumulateDrawnNumbers(current: number[], incoming: number[]) {
  if (!Array.isArray(incoming)) return current;
  // Trust Server: Always use the latest list from server to avoid ghost numbers from optimistic updates or branches.
  // The only exception is if incoming is empty, which might be a glitch OR a reset.
  // RoomStore RESET usually handles hard resets.
  // If we receive an empty list via realtime, it usually means New Round.
  return incoming;
}

type RealtimeState = 'IDLE' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'ERROR';

type RoomStore = {
  roomId: string | null;
  room: Room | null;
  currentUserId: string | null;

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
  myStatus: 'pending' | 'accepted' | 'rejected' | null;
  notifiedLeaverIds: string[]; // Avoid duplicates

  setRoomId: (id: string | null) => void;

  bootstrap: (roomId: string) => Promise<void>;
  subscribe: (roomId: string) => () => void;

  refreshParticipants: (roomId: string) => Promise<void>;

  approve: (participantId: string) => Promise<void>;
  reject: (participantId: string) => Promise<void>;
  updateRoomStatus: (status: 'waiting' | 'playing' | 'finished') => Promise<void>;
  joinRoomWithStatus: (roomId: string, userId: string, initialStatus: 'pending' | 'accepted') => Promise<void>;

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
  currentUserId: null,
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
  myStatus: null,
  notifiedLeaverIds: [],

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
        myStatus: null,
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
        myStatus: null,
      });
    }

    set({ roomId: id });
  },

  bootstrap: async (roomId) => {
    if (roomId === 'tutorial-mock') return;
    set({ lastError: null });

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*, host_profile:host_id(username)')
      .eq('id', roomId)
      .single();

    // Guard: se o user mudou de sala no meio
    if (get().roomId && get().roomId !== roomId) return;

    if (roomErr || !room) {
      set({
        room: null,
        pending: [],
        accepted: [],
        notifiedLeaverIds: [],
        lastError: roomErr?.message ?? 'room not found',
      });
      return;
    }

    const drawn = Array.isArray((room as any).drawn_numbers) ? (room as any).drawn_numbers : [];

    // Set current user ID immediately before any participant logic
    const { data: { user } } = await supabase.auth.getUser();
    set({
      room: { ...(room as any), drawn_numbers: drawn },
      currentUserId: user?.id || null,
      notifiedLeaverIds: []
    });

    await get().refreshParticipants(roomId);
  },

  refreshParticipants: async (roomId) => {
    if (roomId === 'tutorial-mock') return;

    // 0. CAPTURE old state IMMEDIATELY at the top to avoid race conditions
    const oldParticipants = [...get().accepted, ...get().pending];
    const currentRoom = get().room;

    // 1. Sync User FIRST
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    if (currentUserId) set({ currentUserId });

    // 2. Fetch fresh participants
    const { data, error } = await supabase
      .from('participants')
      .select('*, profiles(username, avatar_url, level, bcoins)')
      .eq('room_id', roomId)
      .in('status', ['pending', 'accepted', 'rejected']);

    // Guard: ignore if room changed during fetch
    if (get().roomId !== roomId && get().subscribedRoomId !== roomId) return;

    if (error) {
      set({ lastError: error.message });
      return;
    }

    const pending = (data ?? []).filter((p: any) => p.status === 'pending');
    const accepted = (data ?? []).filter((p: any) => p.status === 'accepted');
    const newParticipants = [...accepted, ...pending];

    // 3. DETECTION LOGIC - Compare lists
    const isHost = currentRoom?.host_id === currentUserId;

    if (isHost && currentUserId && oldParticipants.length > 0) {
      const leavers = oldParticipants.filter(old => !newParticipants.some(now => now.id === old.id));
      const alreadyNotified = get().notifiedLeaverIds;

      leavers.forEach(l => {
        // Notification for host only, and only if it's not the host (safety skip)
        // AND check if we already notified via direct Realtime DELETE
        if (l.user_id !== currentUserId && !alreadyNotified.includes(l.id)) {
          const name = l.profiles?.username || 'Um jogador';
          useNotificationStore.getState().show(`${name} abandonou a mesa.`, 'info');
          set(s => ({ notifiedLeaverIds: [...s.notifiedLeaverIds, l.id] }));
        }
      });
    }

    set({ pending, accepted });

    // 1b. Sync myStatus
    if (session?.user) {
      // Direct fetch for my status to be sure (including rejected)
      const { data: myPart } = await supabase.from('participants')
        .select('status')
        .eq('room_id', roomId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (myPart) set({ myStatus: myPart.status as any });
      else set({ myStatus: null });
    }

    // 2. Refresh rápido no status da sala
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*, host_profile:host_id(username)')
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
    if (roomId === 'tutorial-mock') return () => { };
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

          // Closure detection for participants
          if (newRoom.status === 'finished' && current?.status !== 'finished') {
            const currentUserId = get().currentUserId;
            const isHost = newRoom.host_id === currentUserId;
            if (!isHost) {
              useNotificationStore.getState().show("A mesa foi encerrada pelo anfitrião.", 'info');
              // Immediate cleanup
              setTimeout(() => {
                get().setRoomId(null);
                // Force navigation back to home? 
                // Since this is in the store, we can't easily navigate directly, 
                // but setting roomId to null will trigger the GameScreen's redirect if implemented.
              }, 1500);
            }
          }

          // Only update drawn_numbers if present in the payload
          // If undefined, it means this update touched other columns (e.g. status)
          // We preserve the current list.
          let mergedDrawn = current?.drawn_numbers || [];
          if (Array.isArray(newRoom.drawn_numbers)) {
            mergedDrawn = accumulateDrawnNumbers(mergedDrawn, newRoom.drawn_numbers);
          }

          set({ room: { ...current, ...newRoom, drawn_numbers: mergedDrawn } });
        }
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (get().subscribedRoomId !== roomId) return;

          // Direct detection for DELETE events (Faster than waiting for refresh comparison)
          if (payload.eventType === 'DELETE' && payload.old) {
            const state = get();
            const currentUserId = state.currentUserId;
            const isHost = state.room?.host_id === currentUserId;

            if (isHost && currentUserId) {
              const oldId = payload.old.id;
              const p = [...state.accepted, ...state.pending].find(x => x.id === oldId);

              if (p && p.user_id !== currentUserId && !state.notifiedLeaverIds.includes(oldId)) {
                const name = p.profiles?.username || 'Um jogador';
                useNotificationStore.getState().show(`${name} abandonou a mesa.`, 'info');
                set(s => ({ notifiedLeaverIds: [...s.notifiedLeaverIds, oldId] }));
              }
            }
          }

          // Trigger state refresh for everyone
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

    // 1. Race Condition Guard: Check limit locally first
    const s = get();
    const limit = s.room?.player_limit || 20;
    // Note: accepted length check should include optimistic updates AND THE HOST (+1)
    if ((s.accepted.length + 1) >= limit) {
      useNotificationStore.getState().show("Limite de jogadores atingido nesta mesa!", 'error');
      return;
    }

    set({ inFlight: { ...get().inFlight, [participantId]: true } });

    // 2. Optimistic Update: Move from pending to accepted immediately
    const participant = s.pending.find(p => p.id === participantId);
    if (participant) {
      const optimisticParticipant = { ...participant, status: 'accepted' as const };
      set(state => ({
        pending: state.pending.filter(p => p.id !== participantId),
        accepted: [...state.accepted, optimisticParticipant]
      }));
    }

    try {
      const { error } = await supabase
        .from('participants')
        .update({ status: 'accepted' })
        .eq('id', participantId);
      if (error) throw error;

      // No need to refresh immediately as Realtime or Polling will catch it,
      // and we already have the optimistic state.
      // But we can do a background refresh to be safe.
      get().refreshParticipants(get().roomId!);
    } catch {
      // Revert optimistic update on error
      if (participant) {
        set(state => ({
          pending: [...state.pending, participant],
          accepted: state.accepted.filter(p => p.id !== participantId)
        }));
      }
      useNotificationStore.getState().show("Erro ao aprovar jogador.", 'error');
    } finally {
      set({ inFlight: { ...get().inFlight, [participantId]: false } });
    }
  },

  reject: async (participantId) => {
    if (get().inFlight[participantId]) return;
    set({ inFlight: { ...get().inFlight, [participantId]: true } });

    try {
      // 1. Get participant details to handle Ban Logic
      const { data: part } = await supabase
        .from('participants')
        .select('room_id, user_id')
        .eq('id', participantId)
        .single();

      if (part) {
        try {
          // 2. Increment rejection count
          const { data: existingBan } = await supabase
            .from('room_bans')
            .select('rejection_count')
            .eq('room_id', part.room_id)
            .eq('user_id', part.user_id)
            .maybeSingle();

          const newCount = (existingBan?.rejection_count || 0) + 1;

          // Ensure table 'room_bans' exists
          await supabase.from('room_bans').upsert({
            room_id: part.room_id,
            user_id: part.user_id,
            rejection_count: newCount
          }, { onConflict: 'room_id,user_id' });
        } catch (banErr) {
          console.warn("Failed to update ban count:", banErr);
        }
      }

      // 3. Update status
      const { error } = await supabase
        .from('participants')
        .update({ status: 'rejected' })
        .eq('id', participantId);
      if (error) throw error;

      await get().refreshParticipants(get().roomId!);
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      set({ inFlight: { ...get().inFlight, [participantId]: false } });
    }
  },

  updateRoomStatus: async (status) => {
    set(state => {
      if (!state.room) return {};
      return { room: { ...state.room, status: status as any } };
    });
  },

  joinRoomWithStatus: async (roomId, userId, initialStatus) => {
    set({ inFlight: { ...get().inFlight, [userId]: true } });
    try {
      // Check if already in room
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('participants').insert({
          room_id: roomId,
          user_id: userId,
          status: initialStatus
        });
      } else {
        await supabase.from('participants').update({
          status: initialStatus
        }).eq('id', (existing as any).id);
      }
      await get().refreshParticipants(roomId);
    } finally {
      set({ inFlight: { ...get().inFlight, [userId]: false } });
    }
  },

  hardExit: async (roomId, userId) => {
    get()._cleanupSubscription();
    await supabase.from('participants').delete().eq('room_id', roomId).eq('user_id', userId);
    set({ roomId: null, room: null, pending: [], accepted: [] });
  },
}));
