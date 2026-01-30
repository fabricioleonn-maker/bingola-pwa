
import React, { useEffect, useState } from 'react';

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    angle: number;
    velocity: number;
    rotation: number;
    opacity: number;
}

export const ConfettiCelebration: React.FC<{ active: boolean }> = ({ active }) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const colors = ['#ff3d71', '#a855f7', '#ff843d', '#22c55e', '#3b82f6', '#facc15'];

    useEffect(() => {
        if (active) {
            const newParticles: Particle[] = [];
            // Generate serpentines
            for (let i = 0; i < 100; i++) {
                newParticles.push({
                    id: i,
                    x: 50, // Center X (percentage)
                    y: 60, // Relative center Y
                    size: Math.random() * 10 + 5,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    angle: Math.random() * 360,
                    velocity: Math.random() * 15 + 10,
                    rotation: Math.random() * 360,
                    opacity: 1
                });
            }
            setParticles(newParticles);

            // Cleanup after 4 seconds
            const timer = setTimeout(() => {
                setParticles([]);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [active]);

    if (!active || particles.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-sm animate-confetti-fall"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.size}px`,
                        height: `${p.size * 0.4}px`,
                        backgroundColor: p.color,
                        transform: `rotate(${p.rotation}deg)`,
                        '--angle': `${p.angle}deg`,
                        '--velocity': `${p.velocity}px`,
                        '--rotation': `${p.rotation + 720}deg`,
                    } as any}
                />
            ))}

            {/* Subtle Firework Explosions */}
            <div className="absolute top-[20%] left-[15%] size-1 bg-white rounded-full animate-firework delay-100" />
            <div className="absolute top-[25%] right-[20%] size-1 bg-white rounded-full animate-firework delay-500" />
            <div className="absolute top-[40%] left-[45%] size-1 bg-white rounded-full animate-firework delay-[1200ms]" />
            <div className="absolute top-[15%] right-[40%] size-1 bg-white rounded-full animate-firework delay-[800ms]" />
            <div className="absolute top-[50%] left-[10%] size-1 bg-white rounded-full animate-firework delay-[1500ms]" />
        </div>
    );
};
