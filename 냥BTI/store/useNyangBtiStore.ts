"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ASSESSMENT_VERSION } from "@/data/assessment-version";
import { createCatAssessment, EMPTY_CAT_PROFILE, migrateCatStore, patchActiveCat, removeCat, syncActiveCat } from "@/lib/cat-store-state";
import type { CatAssessment, CatProfile, SurveyAnswers } from "@/types/nyangbti";

interface NyangBtiState {
  cats: CatAssessment[];
  activeCatId: string | null;
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
  addCat: () => string;
  selectCat: (id: string) => void;
  deleteCat: (id: string) => void;
}

const updateActive = (state: NyangBtiState, patch: Partial<Pick<CatAssessment, "profile" | "answers" | "questionIndex" | "assessmentVersion">>) => {
  return patchActiveCat(state, patch);
};

export const useNyangBtiStore = create<NyangBtiState>()(
  persist(
    (set) => ({
      cats: [],
      activeCatId: null,
      profile: EMPTY_CAT_PROFILE,
      answers: {},
      questionIndex: 0,
      assessmentVersion: ASSESSMENT_VERSION,
      hasHydrated: false,
      setProfile: (profile) => set((state) => updateActive(state, { profile })),
      setAnswer: (questionId, value) =>
        set((state) => updateActive(state, { answers: { ...state.answers, [questionId]: value } })),
      setQuestionIndex: (questionIndex) => set((state) => updateActive(state, { questionIndex })),
      clearAnswers: () =>
        set((state) => updateActive(state, { answers: {}, questionIndex: 0, assessmentVersion: ASSESSMENT_VERSION })),
      reset: () =>
        set((state) => updateActive(state, { profile: { ...EMPTY_CAT_PROFILE }, answers: {}, questionIndex: 0, assessmentVersion: ASSESSMENT_VERSION })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      addCat: () => {
        const cat = createCatAssessment();
        set((state) => syncActiveCat([...state.cats, cat], cat.id));
        return cat.id;
      },
      selectCat: (id) => set((state) => syncActiveCat(state.cats, id)),
      deleteCat: (id) => set((state) => removeCat(state, id)),
    }),
    {
      name: "nyangbti-survey-v1",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ cats, activeCatId }) => ({
        cats,
        activeCatId,
      }),
      migrate: (persistedState, version) => migrateCatStore(persistedState, version) as NyangBtiState,
      merge: (persistedState, currentState) => {
        // Zustand skips `migrate` when the persisted version already matches.
        // Sanitize here as well so malformed current-version snapshots cannot
        // crash the app after hydration.
        const active = migrateCatStore(persistedState, 3);
        return { ...currentState, ...active };
      },
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Keep the stored value intact. The error may be a temporary storage
          // restriction or a write quota error rather than corrupt data.
          return;
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
