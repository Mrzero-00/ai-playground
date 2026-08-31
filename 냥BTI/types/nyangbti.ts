export const TRAIT_KEYS = [
  "sociability",
  "boldness",
  "activity",
  "playfulness",
  "adaptability",
  "sensitivity",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export type TraitScores = Record<TraitKey, number>;

export type HumanMbti =
  | "ISTJ"
  | "ISFJ"
  | "INFJ"
  | "INTJ"
  | "ISTP"
  | "ISFP"
  | "INFP"
  | "INTP"
  | "ESTP"
  | "ESFP"
  | "ENFP"
  | "ENTP"
  | "ESTJ"
  | "ESFJ"
  | "ENFJ"
  | "ENTJ";

export type NyangBtiCode = HumanMbti;

export type CatSex = "female" | "male" | "unknown";

export interface CatProfile {
  name: string;
  birthDate: string;
  breed: string;
  sex: CatSex | "";
  neutered: "yes" | "no" | "unknown" | "";
  guardianMbti: HumanMbti | "unknown" | "";
}

export interface CatAssessment {
  id: string;
  profile: CatProfile;
  answers: SurveyAnswers;
  questionIndex: number;
  assessmentVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  trait: TraitKey;
  prompt: string;
  example: string;
  context?: string;
  weights: Partial<Record<TraitKey, number>>;
}

export type SurveyAnswers = Record<string, number>;

export type AxisKey = "EI" | "NS" | "TF" | "JP";

export interface AxisResult {
  key: AxisKey;
  first: string;
  second: string;
  firstScore: number;
  selected: string;
  strength: number;
  level: "낮음" | "중간" | "높음";
  label: string;
}

export interface NyangBtiResult {
  code: NyangBtiCode;
  traits: TraitScores;
  axes: Record<AxisKey, AxisResult>;
}

export interface TypeContent {
  code: NyangBtiCode;
  name: string;
  tagline: string;
  description: string;
  strengths: string[];
  cautions: string[];
  observationSigns: string[];
  care: {
    play: string;
    environment: string;
    routine: string;
    relationship: string;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface InteractionProfile {
  interaction: number;
  stimulation: number;
  routine: number;
  independence: number;
  adaptability: number;
}

export interface CompatibilityResult {
  score: number;
  title: string;
  goodFit: string;
  adjustment: string;
  tip: string;
}
