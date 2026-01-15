import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore } from '../state/roomStore';

export const PersistentGameLoop: React.FC = () => {
    const roomId = useRoomStore(s => s.roomId);
    const room = useRoomStore(s => s.room);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPaused, setIsPaused] = useState(localStorage.getItem('bingola_is_paused') === 'true');

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });

        const handleStorage = () => {
            setIsPaused(localStorage.getItem('bingola_is_paused') === 'true');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Poll for local storage pause changes (since storage event is only for OTHER tabs)
    useEffect(() => {
        const interval = setInterval(() => {
            const paused = localStorage.getItem('bingola_is_paused') === 'true';
            if (paused !== isPaused) setIsPaused(paused);
        }, 1000);
        return () => clearInterval(interval);
    }, [isPaused]);

    // Game Loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (!roomId || !room || !currentUserId) return;

            // 1. Host Check
            if (room.host_id !== currentUserId) return;

            // 2. Status Check
            if (room.status !== 'playing') return;

            // 3. Pause Check (Local or DB check implied by status, but pause is local usually?)
            // The user mentioned: "somente pausar se o host pausar no botão"
            // The button sets localStorage 'bingola_is_paused'.
            if (isPaused) return;

            // 4. Winner Check (Pause on winner)
            // We check localStorage for last winner to avoid re-parsing state too much, or rely on room state if we added it there.
            // But typically winner announcement sets is_paused=true.
            if (localStorage.getItem('bingola_last_winner')) return;

            // 5. Draw Logic - Host Authority with Server Sync
            // We use the NEWEST timestamp. If we just drew locally, local is newer (and authoritative for us).
            // If we just loaded or changed devices, server is newer.
            // This prevents "Echo Lag" where we draw, but the server echo hasn't arrived, so we see an old timestamp and draw again.
            const localLastDraw = Number(localStorage.getItem('bingola_last_draw_time') || 0);
            const serverLastDrawStr = room.updated_at;
            const serverLastDraw = serverLastDrawStr ? new Date(serverLastDrawStr).getTime() : 0;

            const lastDraw = Math.max(localLastDraw, serverLastDraw);
            if (lastDraw === 0) {
                // First draw ever? Or just start?
                // If status is playing and no draw time, maybe draw immediately?
                // But typically handleStart sets a timestamp.
            }

            const drawDelay = (room.draw_interval || 12); // seconds
            const elapsed = Math.floor((Date.now() - lastDraw) / 1000);

            if (elapsed >= drawDelay && !isDrawing) {
                drawNumber(roomId, room.drawn_numbers || []);
            }
        }, 200); // Check 5x per second for precision

        return () => clearInterval(interval);
    }, [roomId, room, currentUserId, isPaused, isDrawing]);

    const drawNumber = async (rId: string, _staleCurrentDrawn: number[]) => {
        setIsDrawing(true);
        try {
            // 1. Fetch FRESH data from DB to avoid race conditions/stale state
            const { data: remoteRoom, error: fetchError } = await supabase
                .from('rooms')
                .select('drawn_numbers, updated_at, draw_interval')
                .eq('id', rId)
                .single();

            if (fetchError || !remoteRoom) throw fetchError || new Error("Room not found");

            // 2. Timestamp Guard: Prevent double-drawing if already updated recently
            const lastServerUpdate = remoteRoom.updated_at ? new Date(remoteRoom.updated_at).getTime() : 0;
            const now = Date.now();
            const timeSinceUpdate = now - lastServerUpdate;

            // If the server was updated less than 3 seconds ago, assume another loop (or tab) already drew.
            // We abort to prevent duplicates or skipping.
            if (timeSinceUpdate < 3000) {
                console.log("Persistent Loop: Aborting draw, server already updated recently.", timeSinceUpdate);
                localStorage.setItem('bingola_last_draw_time', lastServerUpdate.toString());
                return;
            }

            const currentDrawn = Array.isArray(remoteRoom.drawn_numbers) ? remoteRoom.drawn_numbers : [];

            // 3. Generate Number based on FRESH list
            const pool = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !currentDrawn.includes(n));
            if (pool.length === 0) return;

            const lucky = pool[Math.floor(Math.random() * pool.length)];
            const newList = [...currentDrawn, lucky];

            // 4. Update DB
            const newUpdateAt = new Date().toISOString();

            // Update local storage immediately to block local loop
            localStorage.setItem('bingola_last_draw_time', now.toString());

            await supabase
                .from('rooms')
                .update({
                    drawn_numbers: newList,
                    updated_at: newUpdateAt
                })
                .eq('id', rId);

            // 5. Host Optimistic Update
            // Immediately update our own UI so we don't wait for the round-trip echo.
            // This fixes "Host has 67, Player has 68" lag.
            if (useRoomStore.getState().room) {
                useRoomStore.setState(s => ({
                    room: s.room ? { ...s.room, drawn_numbers: newList, updated_at: newUpdateAt } : null
                }));
            }

        } catch (err) {
            console.error("Persistent Loop: Error drawing", err);
        } finally {
            setIsDrawing(false);
        }
    };

    return null; // Hidden component
};
