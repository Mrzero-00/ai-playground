"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CatProfile, SurveyAnswers } from "@/types/nyangbti";

const EMPTY_PROFILE: CatProfile = {
  name: "",
  birthDate: "",
  breed: "",
  sex: "",
  neutered: "",
  guardianMbti: "",
};

interface NyangBtiState {
  profile: CatProfile;
  answers: SurveyAnswers;
  questionIndex: number;
  hasHydrated: boolean;
  setProfile: (profile: CatProfile) => void;
  setAnswer: (questionId: string, value: number) => void;
  setQuestionIndex: (index: number) => void;
  clearAnswers: () => void;
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useNyangBtiStore = create<NyangBtiState>()(
  persist(
    (set) => ({
      profile: EMPTY_PROFILE,
      answers: {},
      questionIndex: 0,
      hasHydrated: false,
      setProfile: (profile) => set({ profile }),
      setAnswer: (questionId, value) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: value } })),
      setQuestionIndex: (questionIndex) => set({ questionIndex }),
      clearAnswers: () => set({ answers: {}, questionIndex: 0 }),
      reset: () => set({ profile: EMPTY_PROFILE, answers: {}, questionIndex: 0 }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "nyangbti-survey-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ profile, answers, questionIndex }) => ({ profile, answers, questionIndex }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
