import type { TraitKey } from "@/types/nyangbti";

export const TRAIT_META: Record<
  TraitKey,
  { label: string; shortLabel: string; description: string; color: string }
> = {
  sociability: {
    label: "사회성",
    shortLabel: "사람 곁",
    description: "사람과 가까이 지내고 교감하려는 경향",
    color: "#ff765f",
  },
  boldness: {
    label: "대담성",
    shortLabel: "용기",
    description: "낯선 대상과 상황에 다가가는 경향",
    color: "#efaa3c",
  },
  activity: {
    label: "활동성",
    shortLabel: "에너지",
    description: "움직임과 신체 활동을 필요로 하는 정도",
    color: "#73a5d8",
  },
  playfulness: {
    label: "놀이성",
    shortLabel: "놀이",
    description: "사냥 놀이와 새로운 자극을 즐기는 정도",
    color: "#8b79c4",
  },
  adaptability: {
    label: "적응성",
    shortLabel: "변화 적응",
    description: "환경과 일과의 변화를 받아들이는 정도",
    color: "#58ad91",
  },
  sensitivity: {
    label: "민감성",
    shortLabel: "섬세함",
    description: "감각과 주변 변화에 세밀하게 반응하는 정도",
    color: "#d87eaa",
  },
};
