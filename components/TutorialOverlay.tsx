import React, { useState, useEffect, useRef } from 'react';
import { useTutorialStore } from '../state/tutorialStore';
import { useAudioStore } from '../state/audioStore';
import { useRoomStore } from '../state/roomStore';

interface TutorialOverlayProps {
    onNavigate: (screen: any) => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onNavigate }) => {
    const { isActive, currentStep, nextStep, skipTutorial, finishTutorial } = useTutorialStore();
    const { setVolume, volume: originalVolume, setDucked } = useAudioStore();
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
    const [audioError, setAudioError] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentAudioIndexRef = useRef<number | null>(null);
    const [configSubStep, setConfigSubStep] = useState(0); // 0: slots, 1: rounds, 2: bpoints

    const stepInfo = [
        { title: "Introdução", text: "Bem-vindo ao Bingola. Sua sorte começa aqui.", targetId: null, screen: 'home', audioIndex: 1 },
        { title: "Criar Mesa", text: "Clique em 'Criar Nova Sala' para começar.", targetId: "create-room-btn", screen: 'home', audioIndex: 2 },
        { title: "Configuração", text: "Defina as vagas, rodadas e bpoints.", targetId: "config-slots-container", screen: 'host_dashboard', audioIndex: 3 },
        { title: "Abrir Mesa", text: "Tudo pronto? Vamos abrir sua mesa.", targetId: "open-mesa-btn", screen: 'host_dashboard', audioIndex: 4 },
        { title: "Lobby do Host", text: "Aqui você controla o ritmo do jogo.", targetId: "settings-gear-btn", screen: 'lobby', audioIndex: 5 },
        { title: "Entrar com Código", text: "Já tem um código? Entre agora.", targetId: "join-personalize-section", screen: 'home', audioIndex: 6 },
        { title: "Inserir PIN", text: "Digite o código da mesa para entrar.", targetId: "join-code-input", screen: 'home', audioIndex: 6 },
        { title: "Lobby do Jogador", text: "Personalize sua cor da sorte aqui!", targetId: "lobby-personalize-btn", screen: 'participant_lobby', audioIndex: 6 },
        { title: "Bem-vindo!", text: "Sua sorte começa aqui.", targetId: null, screen: 'home', audioIndex: 7 },
    ];

    const currentStepInfo = stepInfo[currentStep - 1];

    const setupMockRoom = (asHost = true) => {
        useRoomStore.setState({
            roomId: 'tutorial-mock',
            myStatus: 'accepted',
            room: {
                id: 'tutorial-mock',
                name: 'Mesa Tutorial',
                code: 'BING',
                host_id: asHost ? 'mock-host' : 'someone-else',
                status: 'waiting',
                player_limit: 10,
                rounds: 5,
                current_round: 1,
                prize_pool: 500,
                drawn_numbers: []
            } as any,
            accepted: [
                { id: 'p1', profiles: { username: 'Maria', avatar_url: null } },
                { id: 'p2', profiles: { username: 'José', avatar_url: null } }
            ] as any
        });
    };

    const clearMockRoom = () => {
        if (useRoomStore.getState().roomId === 'tutorial-mock') {
            useRoomStore.setState({ roomId: null, room: null, accepted: [], myStatus: null });
        }
    };

    useEffect(() => {
        if (!isActive) {
            setDucked(false);
            clearMockRoom();
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            currentAudioIndexRef.current = null;
            return;
        }

        // 1. Navigation & Mock logic
        const syncScreen = async () => {
            if (currentStep === 5) {
                setupMockRoom(true); // Host Lobby
                await new Promise(r => setTimeout(r, 800)); // Delay to ensure state settles
            } else if (currentStep === 8) {
                setupMockRoom(false); // Participant Lobby
                await new Promise(r => setTimeout(r, 400));
            } else if (currentStep < 5 || (currentStep > 5 && currentStep < 8)) {
                clearMockRoom();
            }
            onNavigate(currentStepInfo.screen);
        };
        syncScreen();

        // 2. Audio Logic (Prevent looping for 6-8)
        const playAudio = async () => {
            const index = currentStepInfo.audioIndex;

            // If already playing this index, don't restart
            if (currentAudioIndexRef.current === index) {
                return;
            }

            setAudioError(false);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

            const audioPath = `/audio/TUTORIAL/ETAPA ${index}.wav`;
            const audio = new Audio(audioPath);
            audio.volume = originalVolume || 0.7;
            audioRef.current = audio;
            currentAudioIndexRef.current = index;

            try {
                setDucked(true);
                console.log(`[Tutorial] Playing audio for step ${currentStep} (index ${index})`);
                await audio.play();
                audio.onended = () => {
                    const latestStep = useTutorialStore.getState().currentStep;
                    console.log(`[Tutorial] Audio ended for step ${latestStep}`);

                    // Auto-advance logic: 1:Intro, 2:Create, 3:Config, 4:Open, 5:HostLobby, 8:PlayerLobby, 9:Encerramento
                    // Steps 6 and 7 have specialized timer-based logic.
                    const triggerSteps = [1, 2, 3, 4, 5, 8, 9];
                    if (triggerSteps.includes(latestStep)) {
                        console.log(`[Tutorial] Auto-advancing from step ${latestStep}`);
                        if (latestStep === 9) finishTutorial();
                        else nextStep();
                    }
                };
            } catch (e) {
                console.warn("[Tutorial] Audio blocked", e);
                setAudioError(true);
            }
        };
        playAudio();

        // 3. Auto-Interactions & Transitions
        if (currentStep === 6) {
            // STEP 6: Click "Entrar" -> Show Modal
            const timer = setTimeout(() => {
                const btn = document.getElementById('join-personalize-section');
                if (btn) btn.click();
                // Move to STEP 7 (PIN explanation) shortly after modal opens
                setTimeout(nextStep, 2000);
            }, 6000); // Wait 6s for initial explanation
            return () => clearTimeout(timer);
        }

        if (currentStep === 7) {
            // STEP 7: Wait while explaining PIN modal
            const timer = setTimeout(() => {
                nextStep(); // Move to Participant Lobby
            }, 10000); // Wait 10s for PIN explanation
            return () => clearTimeout(timer);
        }

        // Granular Step 3 internal cycling
        if (currentStep === 3) {
            const cycle = setInterval(() => {
                setConfigSubStep(prev => (prev + 1) % 3);
            }, 1500);
            return () => clearInterval(cycle);
        }

    }, [isActive, currentStep, originalVolume]);

    // Spotlight logic
    useEffect(() => {
        if (!isActive) return;

        let retryTimer: any;
        let attempts = 0;

        const findAndSpot = () => {
            let targetId = currentStepInfo.targetId;
            if (currentStep === 3) {
                const subTargets = ["config-slots-container", "config-rounds-container", "config-bpoints-container"];
                targetId = subTargets[configSubStep];
            }

            if (targetId) {
                const element = document.getElementById(targetId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setSpotlightRect(element.getBoundingClientRect());
                } else if (attempts < 30) {
                    attempts++;
                    retryTimer = setTimeout(findAndSpot, 150);
                } else {
                    setSpotlightRect(null);
                }
            } else {
                setSpotlightRect(null);
            }
        };

        const timer = setTimeout(findAndSpot, (currentStep === 5 || currentStep === 8) ? 800 : 400);
        return () => { clearTimeout(timer); clearTimeout(retryTimer); };
    }, [isActive, currentStep, configSubStep, currentStepInfo.targetId]);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[1000] pointer-events-none">
            {spotlightRect && (
                <div
                    className="absolute border-4 border-primary rounded-2xl animate-ping opacity-75"
                    style={{
                        left: spotlightRect.left - 4,
                        top: spotlightRect.top - 4,
                        width: spotlightRect.width + 8,
                        height: spotlightRect.height + 8,
                        zIndex: 1001
                    }}
                />
            )}

            <div
                className="absolute inset-0 bg-black/60 transition-all duration-500"
                style={{
                    clipPath: spotlightRect
                        ? `polygon(0% 0%, 0% 100%, ${spotlightRect.left}px 100%, ${spotlightRect.left}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.bottom}px, ${spotlightRect.left}px ${spotlightRect.bottom}px, ${spotlightRect.left}px 100%, 100% 100%, 100% 0%)`
                        : 'none'
                }}
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-auto">
                <div
                    className={`bg-black/20 backdrop-blur-md border border-white/10 p-6 rounded-[2.5rem] shadow-2xl max-w-xs w-full transition-all duration-500 ${spotlightRect ? 'mt-auto mb-16' : ''}`}
                    style={spotlightRect ? { transform: spotlightRect.top < window.innerHeight / 2 ? 'translateY(20px)' : 'translateY(-20px)' } : {}}
                >
                    {currentStep < 9 && (
                        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase mb-4">
                            Dica {currentStep} de 9
                        </div>
                    )}

                    {currentStep === 9 && (
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                                <span className="material-symbols-outlined text-primary text-4xl">check_circle</span>
                            </div>
                        </div>
                    )}

                    <h3 className="text-2xl font-black italic mb-2 text-center">{currentStepInfo.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-6 text-center">{currentStepInfo.text}</p>

                    <div className="flex gap-3">
                        {currentStep < 9 && (
                            <button onClick={skipTutorial} className="flex-1 h-14 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-white/40">Pular</button>
                        )}
                        <button onClick={currentStep === 9 ? finishTutorial : nextStep} className="flex-[2] h-14 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 w-full">
                            {currentStep === 9 ? 'Entendido' : 'Próximo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;
