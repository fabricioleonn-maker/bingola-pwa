const KEY = 'bingola_active_room_id';

export const persistRoomId = (roomId: string | null) => {
    if (!roomId || roomId === 'null' || roomId.trim() === '') {
        localStorage.removeItem(KEY);
        return;
    }
    localStorage.setItem(KEY, roomId);
};

export const clearPersistedRoomId = () => {
    localStorage.removeItem(KEY);
};

export const readPersistedRoomId = (): string | null => {
    const v = localStorage.getItem(KEY);
    return (v && v !== 'null' && v.trim().length > 0) ? v : null;
};

const NO_RESUME_KEY = 'bingola_force_no_resume'; // string Date.now()

export const setNoResume = () => localStorage.setItem(NO_RESUME_KEY, Date.now().toString());
export const canAutoResume = (ms = 60000) => {
    const raw = localStorage.getItem(NO_RESUME_KEY);
    if (!raw) return true;
    const t = Number(raw);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t > ms;
};

/**
 * Clears ALL local state that can cause "phantom" lobbies/games after a DB reset
 */
export const clearBingolaLocalState = () => {
    const keysToRemove = [
        'bingola_active_room',
        'bingola_active_room_id',
        'bingola_room_id',
        'bingola_game_running',
        'bingola_is_paused',
        'bingola_last_draw_time',
        'bingola_drawn_numbers',
        'bingola_last_winner',
        'bingola_game_settings'
    ];
    for (const k of keysToRemove) {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
};
