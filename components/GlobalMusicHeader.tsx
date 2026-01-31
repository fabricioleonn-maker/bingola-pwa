import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore, MusicGenre, GENRE_MANIFEST } from '../state/audioStore';

interface Props {
    currentScreen?: string;
}

const GlobalMusicHeader: React.FC<Props> = ({ currentScreen }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const { isPlaying, isMuted, volume, currentGenre, currentTrackIndex, togglePlay, toggleMute, setVolume, setGenre, nextTrack, prevTrack } = useAudioStore();
    const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync visibility with playback state
    useEffect(() => {
        if (isPlaying) {
            // Always revealed while playing
            setIsRevealed(true);
            if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
        } else {
            // If paused, minimize and wait 5s to hide ghost controls
            setIsExpanded(false);
            if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
            revealTimeoutRef.current = setTimeout(() => {
                setIsRevealed(false);
            }, 5000);
        }
        return () => { if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current); };
    }, [isPlaying]);

    // Hide on specific screens (Always called after all hooks)
    if (currentScreen === 'login' || currentScreen === 'register' || currentScreen === 'splash' || currentScreen === 'reset_password') {
        return null;
    }

    const isFloating = currentScreen === 'game';
    const genres: { id: MusicGenre, label: string }[] = [
        { id: '00INTRO', label: 'Intro' },
        { id: '01RELAXANTE', label: 'Relaxante' },
        { id: '02CLÁSSICO', label: 'Clássico' },
        { id: '03MODERNO', label: 'Moderno' },
        { id: '04ELETRONICO', label: 'Eletrônico' },
    ];

    return (
        <div
            onClick={() => !isExpanded && setIsExpanded(true)}
            style={{
                height: isExpanded ? 'auto' : undefined,
                paddingTop: 'env(safe-area-inset-top)',
            }}
            className={`fixed top-0 left-0 right-0 z-[200] flex flex-col items-center transition-all duration-500 ease-in-out ${isExpanded ? 'bg-background-dark/95 backdrop-blur-xl border-b border-white/10 pb-6' : 'min-h-[calc(env(safe-area-inset-top)+40px)] group bg-background-dark/40 backdrop-blur-md border-b border-white/5 cursor-pointer'}`}>
            {/* The "Invisible" Trigger Bar */}
            <div
                onClick={(e) => { if (isExpanded) { e.stopPropagation(); setIsExpanded(false); } }}
                className={`w-full flex items-center justify-between px-4 transition-all ${isExpanded ? 'h-10 cursor-pointer' : 'flex-1 hover:bg-white/5'}`}
            >
                {/* Fixed Overlap: Shift Handle to the left */}
                <div className="flex-1 flex justify-start pl-6">
                    <div className={`w-12 h-1 rounded-full bg-white/20 transition-all ${isExpanded ? 'rotate-180 bg-white/40' : 'group-hover:w-20 group-hover:bg-primary/60'}`} />
                </div>

                {!isExpanded && (
                    <div
                        onClick={(e) => { e.stopPropagation(); setIsRevealed(true); }}
                        className="absolute right-2 flex items-center gap-3 h-full px-2"
                    >
                        {/* Almost Invisible Controls (Ghost UI) */}
                        <div className={`flex items-center gap-1 transition-all duration-300 ${isRevealed ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (isRevealed) prevTrack(); else setIsRevealed(true); }}
                                className="p-1 hover:text-white text-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">skip_previous</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (isRevealed) togglePlay(); else setIsRevealed(true); }}
                                className="p-1 hover:text-white text-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (isRevealed) nextTrack(); else setIsRevealed(true); }}
                                className="p-1 hover:text-white text-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">skip_next</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (isRevealed) toggleMute(); else setIsRevealed(true); }}
                                className={`p-1 transition-colors ${isMuted ? 'text-red-500/40' : 'text-white/10 hover:text-white'}`}
                            >
                                <span className="material-symbols-outlined text-[14px]">{isMuted ? 'volume_off' : 'volume_up'}</span>
                            </button>
                        </div>

                        {/* Beat Animation - Fixed Width to prevent shifting */}
                        <div className="w-6 flex items-center justify-center">
                            {isPlaying && !isMuted ? (
                                <div className="flex items-center gap-0.5 opacity-20 group-hover:opacity-80 transition-opacity">
                                    <div className="w-0.5 h-2 bg-primary animate-[music-wave_0.5s_infinite_ease-in-out_0.1s]" />
                                    <div className="w-0.5 h-3 bg-primary animate-[music-wave_0.5s_infinite_ease-in-out_0.2s]" />
                                    <div className="w-0.5 h-1.5 bg-primary animate-[music-wave_0.5s_infinite_ease-in-out_0.3s]" />
                                </div>
                            ) : (
                                <div className="w-3" /> // Spacer for static state
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Expanded Content */}
            <div className={`w-full max-w-[430px] px-6 overflow-hidden transition-all duration-500 ${isExpanded ? 'max-h-[400px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                <div className="flex items-center justify-between mb-6 group/header-top px-2">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? 'bg-primary/20 text-primary animate-spin-slow' : 'bg-white/5 text-white/20'}`}>
                            <span className="material-symbols-outlined">{isPlaying ? 'music_note' : 'music_off'}</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Bingola Music</p>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-tighter mt-0.5">
                                {genres.find(g => g.id === currentGenre)?.label || currentGenre.replace(/^\d+/, '') || 'Música'}
                            </p>
                            <p className="text-xs font-bold text-white truncate max-w-[150px]">
                                {(GENRE_MANIFEST[currentGenre]?.[currentTrackIndex] || '---').replace('.mp3', '').replace('.wav', '')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 transition-all duration-300">
                        <button
                            onClick={prevTrack}
                            className="w-8 h-8 rounded-full bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                        >
                            <span className="material-symbols-outlined text-base">skip_previous</span>
                        </button>
                        <button
                            onClick={nextTrack}
                            className="w-8 h-8 rounded-full bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                        >
                            <span className="material-symbols-outlined text-base">skip_next</span>
                        </button>
                        <button
                            onClick={toggleMute}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/40'}`}
                        >
                            <span className="material-symbols-outlined text-base">{isMuted ? 'volume_off' : 'volume_up'}</span>
                        </button>
                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-all"
                        >
                            <span className="material-symbols-outlined text-xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-6">
                    {genres.map((genre) => (
                        <button
                            key={genre.id}
                            onClick={() => setGenre(genre.id)}
                            className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all border ${currentGenre === genre.id ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                        >
                            {genre.label.slice(0, 3)}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Master Volume</p>
                        <span className="text-[10px] font-black text-primary">{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume * 100}
                        onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                    />
                </div>

                <button
                    onClick={() => setIsExpanded(false)}
                    className="w-full mt-6 py-2 text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-white/40 transition-colors"
                >
                    Recolher
                </button>
            </div>

            <style>{`
                @keyframes music-wave {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
                .animate-spin-slow {
                    animation: spin 6s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default GlobalMusicHeader;
