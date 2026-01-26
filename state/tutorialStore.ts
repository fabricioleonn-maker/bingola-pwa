import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useAudioStore } from './audioStore';

export interface TutorialState {
    isActive: boolean;
    currentStep: number;
    hasSeenTutorial: boolean;
    startTutorial: () => void;
    nextStep: () => void;
    prevStep: () => void;
    skipTutorial: () => void;
    setStep: (step: number) => void;
    finishTutorial: () => void;
}

export const useTutorialStore = create<TutorialState>()(
    persist(
        (set, get) => ({
            isActive: false,
            currentStep: 1,
            hasSeenTutorial: false,
            startTutorial: () => {
                const s = get();
                if (s.isActive) return; // Prevent reset if already in progress
                set({ isActive: true, currentStep: 1 });
            },
            nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 9) })),
            prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
            skipTutorial: async () => {
                const s = get();
                if (!s.hasSeenTutorial) {
                    useAudioStore.getState().playIntro();
                }
                set({ isActive: false, hasSeenTutorial: true });
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('profiles').update({ has_seen_tutorial: true }).eq('id', user.id);
                }
            },
            setStep: (step: number) => set({ currentStep: step, isActive: true }),
            finishTutorial: async () => {
                const s = get();
                if (!s.hasSeenTutorial) {
                    useAudioStore.getState().playIntro();
                }
                set({ isActive: false, hasSeenTutorial: true });
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('profiles').update({ has_seen_tutorial: true }).eq('id', user.id);
                }
            },
        }),
        {
            name: 'bingola-tutorial-storage',
        }
    )
);
