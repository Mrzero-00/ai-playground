import type { HumanMbti, InteractionProfile } from "@/types/nyangbti";

export const HUMAN_MBTI_CODES: HumanMbti[] = [
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
];

/** 사람 MBTI는 생활 상호작용 스타일로만 변환하며 심리검사 결과로 해석하지 않는다. */
export const HUMAN_MBTI_PROFILES: Record<HumanMbti, InteractionProfile> = {
  ENFP: { interaction: 85, stimulation: 90, routine: 35, independence: 40, adaptability: 85 },
  ENFJ: { interaction: 85, stimulation: 70, routine: 75, independence: 15, adaptability: 50 },
  ENTP: { interaction: 75, stimulation: 90, routine: 30, independence: 55, adaptability: 85 },
  ENTJ: { interaction: 75, stimulation: 70, routine: 70, independence: 30, adaptability: 50 },
  ESFP: { interaction: 85, stimulation: 55, routine: 55, independence: 40, adaptability: 65 },
  ESFJ: { interaction: 85, stimulation: 35, routine: 95, independence: 15, adaptability: 30 },
  ESTP: { interaction: 75, stimulation: 55, routine: 50, independence: 55, adaptability: 65 },
  ESTJ: { interaction: 75, stimulation: 35, routine: 90, independence: 30, adaptability: 30 },
  INFP: { interaction: 30, stimulation: 75, routine: 40, independence: 85, adaptability: 75 },
  INFJ: { interaction: 30, stimulation: 55, routine: 80, independence: 60, adaptability: 40 },
  INTP: { interaction: 20, stimulation: 75, routine: 35, independence: 100, adaptability: 75 },
  INTJ: { interaction: 20, stimulation: 55, routine: 75, independence: 75, adaptability: 40 },
  ISFP: { interaction: 30, stimulation: 40, routine: 60, independence: 85, adaptability: 55 },
  ISFJ: { interaction: 30, stimulation: 20, routine: 100, independence: 60, adaptability: 20 },
  ISTP: { interaction: 20, stimulation: 40, routine: 55, independence: 100, adaptability: 55 },
  ISTJ: { interaction: 20, stimulation: 20, routine: 95, independence: 75, adaptability: 20 },
};
