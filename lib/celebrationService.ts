
/**
 * Global celebration service using canvas-confetti
 */

declare const confetti: any;

const playSFX = (path: string) => {
    console.log(`[SFX] Playing: ${path}`);
    try {
        const audio = new Audio(path);
        audio.volume = 0.8; // Higher volume for SFX
        audio.play().catch(e => {
            console.warn(`[SFX] Play blocked for ${path}:`, e);
        });
    } catch (e) {
        console.error(`[SFX] Error for ${path}:`, e);
    }
};

export const triggerWinCelebration = () => {
    console.log('[Celebration] Triggering Win Animation...');
    if (typeof (window as any).confetti === 'undefined') {
        console.error('[Celebration] ERROR: canvas-confetti library NOT LOADED. Check index.html or network.');
        return;
    }
    const confetti = (window as any).confetti;

    // Play sound
    playSFX('/audio/sfx/bingo_win.mp3');

    // 1. Initial burst
    confetti({
        particleCount: 150,
        spread: 90,
        startVelocity: 45,
        origin: { y: 0.6 },
        colors: ['#ff3d71', '#a855f7', '#ff843d', '#22c55e', '#3b82f6', '#facc15'],
        zIndex: 10000
    });

    // 2. Side streams (serpentines)
    const duration = 5000;
    const end = Date.now() + duration;

    const frame = () => {
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: Math.random() },
            ticks: 200,
            gravity: 0.6,
            decay: 0.94,
            drift: 0.2,
            zIndex: 10000,
            colors: ['#ff3d71', '#a855f7']
        });

        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: Math.random() },
            ticks: 200,
            gravity: 0.6,
            decay: 0.94,
            drift: -0.2,
            zIndex: 10000,
            colors: ['#3b82f6', '#facc15']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };
    frame();

    // 3. Fireworks bursts (occasional)
    const fireworkInterval = setInterval(() => {
        if (Date.now() > end) {
            clearInterval(fireworkInterval);
            return;
        }

        confetti({
            particleCount: 40,
            spread: 120,
            startVelocity: 25,
            origin: {
                x: 0.2 + Math.random() * 0.6,
                y: 0.2 + Math.random() * 0.4
            },
            ticks: 300,
            gravity: 1,
            scalar: 1,
            zIndex: 10000,
            colors: ['#ff3d71', '#ffffff', '#a855f7']
        });
    }, 1500);
};

export const triggerLoseSound = () => {
    playSFX('/audio/sfx/lose.mp3');
};
