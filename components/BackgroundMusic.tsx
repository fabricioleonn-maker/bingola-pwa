import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore, GENRE_MANIFEST, MusicGenre } from '../state/audioStore';

interface Props {
    currentScreen?: string;
}

const BackgroundMusic: React.FC<Props> = ({ currentScreen }) => {
    const { isMuted, isPlaying, togglePlay, volume, currentGenre, introRequested, currentTrackIndex, clearIntro, nextTrack, resetTrack, isDucked } = useAudioStore();
    const hasAutoStartedRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackRef = useRef<string | null>(null);
    const [isIntroPlaying, setIsIntroPlaying] = useState(false);

    // Auto-start on mount
    useEffect(() => {
        if (!hasAutoStartedRef.current && !isPlaying && !isMuted) {
            console.log("[Audio] System auto-start triggered on mount");
            togglePlay();
            hasAutoStartedRef.current = true;
        }
    }, [isPlaying, isMuted, togglePlay]);

    // First interaction unblocker (Aggressive & State-Driving)
    useEffect(() => {
        const handleUnblock = async () => {
            console.log("[Audio] Interaction detected. Attempting to drive state and unblock...");

            // If the store says we aren't playing, try to set it to playing
            if (!isPlaying && !isMuted) {
                togglePlay();
            }

            if (audioRef.current) {
                try {
                    await audioRef.current.play();
                    console.log("[Audio] Playback started successfully via interaction.");

                    // Cleanup
                    window.removeEventListener('mousedown', handleUnblock);
                    window.removeEventListener('touchstart', handleUnblock);
                    window.removeEventListener('keydown', handleUnblock);
                } catch (e) {
                    console.warn("[Audio] Direct play failed, but state might have updated:", e);
                }
            }
        };

        if (!isPlaying) {
            window.addEventListener('mousedown', handleUnblock, { once: true, capture: true });
            window.addEventListener('touchstart', handleUnblock, { once: true, capture: true });
            window.addEventListener('keydown', handleUnblock, { once: true, capture: true });
        }

        return () => {
            window.removeEventListener('mousedown', handleUnblock, true);
            window.removeEventListener('touchstart', handleUnblock, true);
            window.removeEventListener('keydown', handleUnblock, true);
        };
    }, [isPlaying, isMuted, togglePlay]);

    // Dynamic track path logic
    const getTrackPath = (genre: MusicGenre, index: number) => {
        const tracks = GENRE_MANIFEST[genre];
        if (!tracks || tracks.length === 0) return null;

        // Ensure index is within bounds
        const safeIndex = Math.max(0, Math.min(index, tracks.length - 1));
        const filename = tracks[safeIndex];

        // Use encodeURI specifically for CLÁSSICO or other special chars
        return encodeURI(`/audio/${genre}/${filename}`);
    };

    // Coordination for the "Welcome Jingle" (Intro requested via Login/Register)
    useEffect(() => {
        if (introRequested && !isMuted) {
            const intro = new Audio('/audio/00INTRO/1.mp3');
            intro.volume = volume;
            setIsIntroPlaying(true);

            intro.play().catch(e => console.warn('[Intro] Playback failed:', e));

            intro.onended = () => {
                setIsIntroPlaying(false);
                clearIntro();
                resetTrack(); // Start playlist from 0
            };
        } else if (introRequested && isMuted) {
            clearIntro();
        }
    }, [introRequested, isMuted, volume, clearIntro, resetTrack]);

    // Sequential Audio Logic
    const { nextGenre } = useAudioStore();

    useEffect(() => {
        const track = getTrackPath(currentGenre, currentTrackIndex);
        if (!track) return;

        if (currentTrackRef.current !== track) {
            currentTrackRef.current = track;

            if (!audioRef.current) {
                const audio = new Audio(track);
                audio.volume = volume;
                audioRef.current = audio;
            } else {
                audioRef.current.src = track;
                audioRef.current.load();
            }

            audioRef.current.onended = () => {
                console.log(`[Audio] Track finished: ${track}. Next...`);
                nextTrack();
            };

            audioRef.current.onerror = (e) => {
                const error = (e as any).target?.error;
                console.warn(`[Audio] CRITICAL ERROR: Failed to load [${track}] in [${currentGenre}]. Code: ${error?.code} - ${error?.message}`);
                // If a track fails, avoid immediate retry loop if manifest is broken
                setTimeout(nextGenre, 2000);
            };

            if (!isMuted && isPlaying && !isIntroPlaying) {
                // Ensure volume is set before playing
                audioRef.current.volume = isDucked ? volume * 0.2 : volume;
                audioRef.current.play().catch((err) => {
                    console.warn('[Audio] Playback blocked or failed:', err);
                });
            }
        }
    }, [currentGenre, currentTrackIndex, isMuted, isPlaying, isIntroPlaying, volume, nextTrack, nextGenre]);

    useEffect(() => {
        if (!audioRef.current) return;

        // Ducking: reduce volume to 20% of original if isDucked is true
        audioRef.current.volume = isDucked ? volume * 0.2 : volume;

        const syncPlayback = async () => {
            if (isMuted || !isPlaying || isIntroPlaying) {
                audioRef.current?.pause();
            } else {
                try {
                    await audioRef.current?.play();
                } catch (e) {
                    console.warn('[Audio] Auto-play block in sync effect:', e);
                }
            }
        };

        syncPlayback();
    }, [isMuted, isPlaying, volume, isIntroPlaying, isDucked]);

    return null;
};

export default BackgroundMusic;
