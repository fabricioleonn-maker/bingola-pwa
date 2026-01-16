import React from 'react';
import { useAudioStore, MusicGenre, GENRE_MANIFEST } from '../state/audioStore';

const MusicPlayerPanel: React.FC = () => {
    const { isPlaying, isMuted, volume, currentGenre, currentTrackIndex, togglePlay, toggleMute, setVolume, setGenre, nextTrack, prevTrack } = useAudioStore();

    const genres: { id: MusicGenre, label: string }[] = [
        { id: '00INTRO', label: 'Intro' },
        { id: '01RELAXANTE', label: 'Relaxante' },
        { id: '02CLÁSSICO', label: 'Clássico' },
        { id: '03MODERNO', label: 'Moderno' },
        { id: '04ELETRONICO', label: 'Eletrônico' },
    ];

    const currentTrackName = GENRE_MANIFEST[currentGenre][currentTrackIndex] || '---';

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6 group/player relative overflow-hidden">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <h3 className="text-sm font-black text-primary uppercase tracking-widest">Bingola Music</h3>
                    <div className="flex flex-col mt-1">
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-tighter">Gênero</p>
                        <p className="text-[10px] text-white/60 font-bold uppercase">{genres.find(g => g.id === currentGenre)?.label}</p>
                    </div>
                    <div className="flex flex-col mt-2">
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-tighter">Música</p>
                        <p className="text-[10px] text-white/80 font-bold truncate pr-4">{currentTrackName.replace('.mp3', '').replace('.wav', '')}</p>
                    </div>
                </div>

                {/* Controls - Always Visible */}
                <div className="flex gap-2 transition-all duration-300">
                    <button
                        onClick={prevTrack}
                        className="w-10 h-10 rounded-full bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">skip_previous</span>
                    </button>
                    <button
                        onClick={togglePlay}
                        className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-110 active:scale-90 transition-all"
                    >
                        <span className="material-symbols-outlined text-2xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button
                        onClick={nextTrack}
                        className="w-10 h-10 rounded-full bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">skip_next</span>
                    </button>
                    <button
                        onClick={toggleMute}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-xl">{isMuted ? 'volume_off' : 'volume_up'}</span>
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Escolher Gênero</p>
                <div className="grid grid-cols-2 gap-2">
                    {genres.map((genre) => (
                        <button
                            key={genre.id}
                            onClick={() => setGenre(genre.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${currentGenre === genre.id ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                        >
                            {genre.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Volume da Música</p>
                    <span className="text-[10px] font-black text-primary">{Math.round(volume * 100)}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                />
            </div>
        </div>
    );
};

export default MusicPlayerPanel;
