import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MusicGenre = '00INTRO' | '01RELAXANTE' | '02CLÁSSICO' | '03MODERNO' | '04ELETRONICO';

export const GENRE_MANIFEST: Record<MusicGenre, string[]> = {
    '00INTRO': ["01 - MUSICA BINGOLA.mp3", "02 - firesidechat.mp3"],
    '01RELAXANTE': [
        "angelsbymyside.mp3", "cozycoffeehouse.mp3", "echoesfromthemountain.mp3",
        "echoofsadness.mp3", "floatinggarden.mp3", "hearty.mp3",
        "melancholylull.mp3", "newfrontier.mp3", "rainyday.mp3",
        "slowlife.mp3", "sunlitdepths.mp3", "yesterday.mp3"
    ],
    '02CLÁSSICO': [
        "10427_1373484008.mp3", "10428_1373484009.mp3", "17224_1461778945.mp3",
        "17243_1461780443.mp3", "17812_1462215574.mp3", "17813_1462215576.mp3",
        "17814_1462215577.mp3", "17825_1462215987.mp3"
    ],
    '03MODERNO': [
        "414270__deleted_user_4397472__sample-97-bpm.wav", "bymyside.mp3",
        "clapandyell.mp3", "dreams.mp3", "endlessmotion.mp3", "energy.mp3",
        "happiness.mp3", "keepitreal.mp3", "rhythmmagnet.mp3", "slowlife.mp3"
    ],
    '04ELETRONICO': ["fragmentsofsunlight.mp3", "sunsetreverie.mp3"]
};

interface AudioState {
    isMuted: boolean;
    isPlaying: boolean;
    volume: number;
    currentGenre: MusicGenre;
    introRequested: boolean;
    currentTrackIndex: number;
    toggleMute: () => void;
    togglePlay: () => void;
    setVolume: (volume: number) => void;
    setGenre: (genre: MusicGenre) => void;
    playIntro: () => void;
    clearIntro: () => void;
    prevTrack: () => void;
    nextTrack: () => void;
    nextGenre: () => void;
    resetTrack: () => void;
    setDucked: (ducked: boolean) => void;
    isDucked: boolean;
    isNarrationMuted: boolean;
    toggleNarration: () => void;
    selectedVoice: string;
    setVoice: (voice: string) => void;
    playSfx: (type: 'drum' | 'drop' | 'win') => void;
}

export const useAudioStore = create<AudioState>()(
    persist(
        (set, get) => ({
            isMuted: false,
            isPlaying: false,
            volume: 0.5,
            currentGenre: '00INTRO',
            introRequested: false,
            currentTrackIndex: 0, // Now refers to array index
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
            setVolume: (volume) => set({ volume }),
            setGenre: (genre) => set({ currentGenre: genre, currentTrackIndex: 0 }),
            playIntro: () => set({ introRequested: true }),
            clearIntro: () => set({ introRequested: false }),
            prevTrack: () => set((state) => {
                const tracks = GENRE_MANIFEST[state.currentGenre];
                const prevIndex = (state.currentTrackIndex - 1 + tracks.length) % tracks.length;
                return { currentTrackIndex: prevIndex };
            }),
            nextTrack: () => set((state) => {
                const tracks = GENRE_MANIFEST[state.currentGenre];
                if (state.currentTrackIndex + 1 >= tracks.length) {
                    const genres: MusicGenre[] = ['00INTRO', '01RELAXANTE', '02CLÁSSICO', '03MODERNO', '04ELETRONICO'];
                    const currentIndex = genres.indexOf(state.currentGenre);
                    const nextIndex = (currentIndex + 1) % genres.length;
                    return { currentGenre: genres[nextIndex], currentTrackIndex: 0 };
                }
                return { currentTrackIndex: (state.currentTrackIndex + 1) };
            }),
            nextGenre: () => set((state) => {
                const genres: MusicGenre[] = ['00INTRO', '01RELAXANTE', '02CLÁSSICO', '03MODERNO', '04ELETRONICO'];
                const currentIndex = genres.indexOf(state.currentGenre);
                const nextIndex = (currentIndex + 1) % genres.length;
                return { currentGenre: genres[nextIndex], currentTrackIndex: 0 };
            }),
            resetTrack: () => set({ currentTrackIndex: 0 }),
            isDucked: false,
            setDucked: (isDucked) => set({ isDucked }),
            isNarrationMuted: false,
            toggleNarration: () => set((state) => ({ isNarrationMuted: !state.isNarrationMuted })),
            selectedVoice: 'vovo',
            setVoice: (voice) => set({ selectedVoice: voice }),
            playSfx: (type) => {
                const s = get();
                if (s.isMuted) return;

                let file = '';
                if (type === 'drum') file = '/audio/sfx/drum_roll.mp3';
                else if (type === 'drop') file = '/audio/sfx/ball_drop.mp3';
                else if (type === 'win') file = '/audio/sfx/bingo_win.mp3';

                if (file) {
                    const audio = new Audio(file);
                    audio.volume = s.volume;
                    audio.play().catch(() => { });
                }
            }
        }),
        {
            name: 'bingola-audio-storage',
            migrate: (persistedState: any, version: number) => {
                // Migration logic to reset genre if it's legacy
                const genres = ['00INTRO', '01RELAXANTE', '02CLÁSSICO', '03MODERNO', '04ELETRONICO'];
                if (persistedState && !genres.includes(persistedState.currentGenre)) {
                    return { ...persistedState, currentGenre: '00INTRO', currentTrackIndex: 0 };
                }
                return persistedState;
            }
        }
    )
);
