"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ASSESSMENT_VERSION } from "@/data/assessment-version";
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
  assessmentVersion: string;
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
      assessmentVersion: ASSESSMENT_VERSION,
      hasHydrated: false,
      setProfile: (profile) => set({ profile }),
      setAnswer: (questionId, value) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: value } })),
      setQuestionIndex: (questionIndex) => set({ questionIndex }),
      clearAnswers: () =>
        set({ answers: {}, questionIndex: 0, assessmentVersion: ASSESSMENT_VERSION }),
      reset: () =>
        set({
          profile: { ...EMPTY_PROFILE },
          answers: {},
          questionIndex: 0,
          assessmentVersion: ASSESSMENT_VERSION,
        }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "nyangbti-survey-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ profile, answers, questionIndex, assessmentVersion }) => ({
        profile,
        answers,
        questionIndex,
        assessmentVersion,
      }),
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<NyangBtiState>;

        if (version < 2 || persisted.assessmentVersion !== ASSESSMENT_VERSION) {
          return {
            ...persisted,
            profile: persisted.profile ?? { ...EMPTY_PROFILE },
            answers: {},
            questionIndex: 0,
            assessmentVersion: ASSESSMENT_VERSION,
          } as NyangBtiState;
        }

        return persistedState as NyangBtiState;
      },
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
