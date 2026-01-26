
const synth = window.speechSynthesis;
let speechQueue: { text: string, voiceType: string }[] = [];
let isSpeaking = false;

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
    const premiumVoice = ptVoices.find(v => v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Daniel'));
    const ptVoice = premiumVoice || ptVoices[0] || voices.find(v => v.default);

    if (ptVoice) utterance.voice = ptVoice;

    // Persona-based settings
    if (next.voiceType === 'vovo') {
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
    } else if (next.voiceType === 'radio') {
        utterance.rate = 1.15;
        utterance.pitch = 1.05;
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
