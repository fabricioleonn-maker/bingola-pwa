import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        (set) => ({
            isActive: false,
            currentStep: 1,
            hasSeenTutorial: false,
            startTutorial: () => set({ isActive: true, currentStep: 1 }),
            nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 9) })),
            prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
            skipTutorial: () => set({ isActive: false }),
            setStep: (step: number) => set({ currentStep: step, isActive: true }),
            finishTutorial: () => set({ isActive: false, hasSeenTutorial: true }),
        }),
        {
            name: 'bingola-tutorial-storage',
        }
    )
);
