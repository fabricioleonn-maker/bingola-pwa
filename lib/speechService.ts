
const synth = window.speechSynthesis;
let speechQueue: { text: string, voiceType: string }[] = [];
let isSpeaking = false;
let isUnlocked = false;

// iOS Safari requires a user interaction to unlock audio context/speech synthesis
export const unlockAudio = () => {
    if (isUnlocked || !synth) return;

    // Play a silent utterance
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    synth.speak(utterance);
    isUnlocked = true;
    console.log('[Audio] TTS Unlocked via interaction');
};

const BALL_PREFIXES = [
    "E lá vem a bola!",
    "Atenção!",
    "Opa!",
    "Olha ela vindo...",
    "Confira aí!",
    "Mais uma saindo!",
    "Roda a roleta!",
    "Sorte na mesa!"
];

const processQueue = () => {
    if (isSpeaking || speechQueue.length === 0 || !synth) return;

    const next = speechQueue.shift();
    if (!next) return;

    isSpeaking = true;
    const utterance = new SpeechSynthesisUtterance(next.text);

    // Get voices
    let voices = synth.getVoices();
    const ptVoices = voices.filter(v => v.lang.startsWith('pt'));

    // Improved Strategy: Priority on known good voices, then ANY PT voice
    const premiumVoice = ptVoices.find(v =>
        v.name.includes('Luciana') || // iOS
        v.name.includes('Joana') || // iOS
        v.name.includes('Google') || // Android/Chrome
        v.name.includes('Daniel') // Classic
    );
    const ptVoice = premiumVoice || ptVoices[0] || voices.find(v => v.default);

    if (ptVoice) utterance.voice = ptVoice;

    // Persona-based settings
    if (next.voiceType === 'vovo') {
        utterance.rate = 0.7; // Slower
        utterance.pitch = 0.6; // Deeper (Elderly effect)
    } else if (next.voiceType === 'radio') {
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        // energetic volume
        utterance.volume = 1.0;
    } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
    }

    utterance.onend = () => {
        isSpeaking = false;
        setTimeout(processQueue, 300); // 300ms gap between calls
    };

    utterance.onerror = () => {
        isSpeaking = false;
        setTimeout(processQueue, 300);
    };

    synth.speak(utterance);
};

export const speakBingoNumber = (number: number, isMuted: boolean, voiceType: string = 'vovo') => {
    if (isMuted || !synth) return;

    let letter = '';
    if (number >= 1 && number <= 15) letter = 'B';
    else if (number >= 16 && number <= 30) letter = 'I';
    else if (number >= 31 && number <= 45) letter = 'N';
    else if (number >= 46 && number <= 60) letter = 'G';
    else if (number >= 61 && number <= 75) letter = 'O';

    let text = `Bola ${letter}, ${number}`;

    // Add prefix for radio persona to make it "exciting"
    if (voiceType === 'radio' && Math.random() > 0.4) {
        const prefix = BALL_PREFIXES[Math.floor(Math.random() * BALL_PREFIXES.length)];
        text = `${prefix} ${text}`;
    }

    speechQueue.push({ text, voiceType });
    processQueue();
};
