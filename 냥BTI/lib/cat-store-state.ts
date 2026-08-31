import { ASSESSMENT_VERSION } from "@/data/assessment-version";
import type { CatAssessment, CatProfile, SurveyAnswers } from "@/types/nyangbti";

export const EMPTY_CAT_PROFILE: CatProfile = {
  name: "", birthDate: "", breed: "", sex: "", neutered: "", guardianMbti: "",
};

export interface CatStoreSnapshot {
  cats: CatAssessment[];
  activeCatId: string | null;
  profile: CatProfile;
  answers: SurveyAnswers;
  questionIndex: number;
  assessmentVersion: string;
}

export interface LegacyCatStoreSnapshot {
  profile?: CatProfile;
  answers?: SurveyAnswers;
  questionIndex?: number;
  assessmentVersion?: string;
  cats?: CatAssessment[];
  activeCatId?: string | null;
}

const makeId = () => `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const timestamp = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function safeAnswers(value: unknown): SurveyAnswers {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function safeProfile(value: unknown): CatProfile {
  if (!isRecord(value)) return { ...EMPTY_CAT_PROFILE };
  return Object.fromEntries(
    Object.entries(EMPTY_CAT_PROFILE).map(([key, fallback]) => [
      key,
      typeof value[key] === "string" ? value[key] : fallback,
    ]),
  ) as unknown as CatProfile;
}

function safeCat(value: unknown): CatAssessment | null {
  if (!isRecord(value)) return null;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : timestamp();
  return {
    id: typeof value.id === "string" && value.id ? value.id : makeId(),
    profile: safeProfile(value.profile),
    answers: safeAnswers(value.answers),
    questionIndex: Number.isInteger(value.questionIndex) && Number(value.questionIndex) >= 0
      ? Number(value.questionIndex)
      : 0,
    assessmentVersion: typeof value.assessmentVersion === "string"
      ? value.assessmentVersion
      : ASSESSMENT_VERSION,
    createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : createdAt,
  };
}

export function createCatAssessment(profile: CatProfile = { ...EMPTY_CAT_PROFILE }, answers: SurveyAnswers = {}, questionIndex = 0): CatAssessment {
  const createdAt = timestamp();
  return { id: makeId(), profile, answers, questionIndex, assessmentVersion: ASSESSMENT_VERSION, createdAt, updatedAt: createdAt };
}

export function syncActiveCat(cats: CatAssessment[], activeCatId: string | null): CatStoreSnapshot {
  const active = cats.find((cat) => cat.id === activeCatId) ?? cats[0];
  return active
    ? { cats, activeCatId: active.id, profile: active.profile, answers: active.answers, questionIndex: active.questionIndex, assessmentVersion: active.assessmentVersion }
    : { cats, activeCatId: null, profile: { ...EMPTY_CAT_PROFILE }, answers: {}, questionIndex: 0, assessmentVersion: ASSESSMENT_VERSION };
}

export function patchActiveCat(snapshot: CatStoreSnapshot, patch: Partial<Pick<CatAssessment, "profile" | "answers" | "questionIndex" | "assessmentVersion">>): CatStoreSnapshot {
  let { cats, activeCatId } = snapshot;
  if (!activeCatId || !cats.some((cat) => cat.id === activeCatId)) {
    const cat = createCatAssessment();
    cats = [...cats, cat];
    activeCatId = cat.id;
  }
  const nextCats = cats.map((cat) => cat.id === activeCatId ? { ...cat, ...patch, updatedAt: timestamp() } : cat);
  return syncActiveCat(nextCats, activeCatId);
}

export function removeCat(snapshot: CatStoreSnapshot, id: string): CatStoreSnapshot {
  const cats = snapshot.cats.filter((cat) => cat.id !== id);
  const nextActiveId = snapshot.activeCatId === id ? (cats[0]?.id ?? null) : snapshot.activeCatId;
  return syncActiveCat(cats, nextActiveId);
}

export function migrateCatStore(persistedState: unknown, version: number): CatStoreSnapshot {
  const persisted = isRecord(persistedState)
    ? persistedState as LegacyCatStoreSnapshot
    : {};
  if (version < 3 || !Array.isArray(persisted.cats)) {
    const profile = safeProfile(persisted.profile);
    const answers = safeAnswers(persisted.answers);
    const resetAssessment = persisted.assessmentVersion !== ASSESSMENT_VERSION;
    const hasLegacyData = Boolean(profile.name) || Object.keys(answers).length > 0;
    if (!hasLegacyData) return syncActiveCat([], null);
    const questionIndex = Number.isInteger(persisted.questionIndex) && Number(persisted.questionIndex) >= 0
      ? Number(persisted.questionIndex)
      : 0;
    const cat = createCatAssessment(profile, resetAssessment ? {} : answers, resetAssessment ? 0 : questionIndex);
    return syncActiveCat([cat], cat.id);
  }

  const cats = persisted.cats.flatMap((value) => {
    const cat = safeCat(value);
    return cat ? [cat] : [];
  }).map((cat) => cat.assessmentVersion === ASSESSMENT_VERSION
    ? cat
    : { ...cat, answers: {}, questionIndex: 0, assessmentVersion: ASSESSMENT_VERSION, updatedAt: timestamp() });
  return syncActiveCat(cats, persisted.activeCatId ?? null);
}
