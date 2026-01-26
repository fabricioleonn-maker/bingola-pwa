import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore, GENRE_MANIFEST, MusicGenre } from '../state/audioStore';
import { useRoomStore } from '../state/roomStore';

interface Props {
    currentScreen?: string;
}

const BackgroundMusic: React.FC<Props> = ({ currentScreen }) => {
    const { isMuted, isPlaying, togglePlay, volume, currentGenre, introRequested, currentTrackIndex, clearIntro, nextTrack, resetTrack, isDucked } = useAudioStore();
    const room = useRoomStore(s => s.room);
    const hasAutoStartedRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const introAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackRef = useRef<string | null>(null);
    const [isIntroPlaying, setIsIntroPlaying] = useState(false);

    // Initializer
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = "auto";
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
            if (introAudioRef.current) {
                introAudioRef.current.pause();
                introAudioRef.current.src = "";
            }
        };
    }, []);

    const isLoginFlow = currentScreen === 'login' || currentScreen === 'register' || currentScreen === 'splash';

    // 1. Interaction Unblocker - Must be active even in login to capture the FIRST click
    useEffect(() => {
        if (hasAutoStartedRef.current) return;

        const handleUnblock = () => {
            console.log("[Audio] System primed via interaction.");
            hasAutoStartedRef.current = true;

            // Clean up listeners
            window.removeEventListener('mousedown', handleUnblock);
            window.removeEventListener('touchstart', handleUnblock);

            // Prime the engine: browsers need a .play() call inside the handler to unblock future autoplay
            if (audioRef.current) {
                if (!isLoginFlow) {
                    if (!isMuted && !isPlaying) togglePlay();
                    audioRef.current.play().catch(() => { });
                } else {
                    // Priming silently on login screen so engine is ready for Home transition
                    audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => { });
                }
            }
        };

        window.addEventListener('mousedown', handleUnblock, { capture: true });
        window.addEventListener('touchstart', handleUnblock, { capture: true });

        return () => {
            window.removeEventListener('mousedown', handleUnblock, true);
            window.removeEventListener('touchstart', handleUnblock, true);
        };
    }, [isPlaying, isMuted, togglePlay, isLoginFlow]);

    // Track path with improved robust encoding
    const getTrackPath = (genre: MusicGenre, index: number) => {
        const tracks = GENRE_MANIFEST[genre];
        if (!tracks || tracks.length === 0) return null;
        const safeIndex = Math.max(0, Math.min(index, tracks.length - 1));
        const filename = tracks[safeIndex];
        return `/audio/${encodeURIComponent(genre)}/${encodeURIComponent(filename)}`;
    };

    // Jingle/Intro Coordinator
    useEffect(() => {
        if (introRequested && !isMuted) {
            // Stop any existing intro
            if (introAudioRef.current) {
                introAudioRef.current.pause();
                introAudioRef.current.src = "";
            }

            console.log("[Audio] Playing Welcome Jingle...");
            const intro = new Audio('/audio/00INTRO/01%20-%20MUSICA%20BINGOLA.mp3');
            intro.volume = volume;
            introAudioRef.current = intro;
            setIsIntroPlaying(true);

            intro.play().catch(e => console.warn('[Intro] Blocked:', e));

            intro.onended = () => {
                setIsIntroPlaying(false);
                clearIntro();
                resetTrack();
                introAudioRef.current = null;
            };
        } else if (introRequested && isMuted) {
            clearIntro();
        }
    }, [introRequested, isMuted, volume, clearIntro, resetTrack]);

    // Sequential & Main Sync Effect
    const { nextGenre } = useAudioStore();

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || isLoginFlow) {
            audio?.pause();
            return;
        }

        const track = getTrackPath(currentGenre, currentTrackIndex);
        if (!track) return;

        if (currentTrackRef.current !== track) {
            console.log(`[Audio] Changing track to: ${track}`);
            currentTrackRef.current = track;
            audio.src = track;
            audio.load();

            audio.onended = () => nextTrack();
            audio.onerror = () => {
                console.warn(`[Audio] Error loading: ${track}`);
                setTimeout(() => useAudioStore.getState().nextGenre(), 1000);
            };
        }

        audio.volume = isDucked ? volume * 0.2 : volume;

        if (isMuted || !isPlaying || isIntroPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => { });
        }
    }, [currentGenre, currentTrackIndex, isMuted, isPlaying, isIntroPlaying, volume, isDucked, isLoginFlow, nextTrack, currentScreen, room?.status]);


    return null;
};

export default BackgroundMusic;
