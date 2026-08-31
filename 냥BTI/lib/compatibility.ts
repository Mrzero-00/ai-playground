import { HUMAN_MBTI_PROFILES } from "@/data/human-mbti";
import type {
  CompatibilityResult,
  HumanMbti,
  InteractionProfile,
  TraitScores,
} from "@/types/nyangbti";
import { withJosa } from "@/lib/korean";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const DIMENSIONS: (keyof InteractionProfile)[] = [
  "interaction",
  "stimulation",
  "routine",
  "independence",
  "adaptability",
];

const DIMENSION_LABELS: Record<keyof InteractionProfile, string> = {
  interaction: "교감의 거리",
  stimulation: "놀이 자극",
  routine: "생활 리듬",
  independence: "혼자만의 시간",
  adaptability: "변화에 맞추는 속도",
};

export function catTraitsToInteractionNeeds(traits: TraitScores): InteractionProfile {
  return {
    interaction: Math.round(traits.sociability * 0.75 + traits.playfulness * 0.25),
    stimulation: Math.round(
      traits.playfulness * 0.55 + traits.activity * 0.3 + traits.boldness * 0.15,
    ),
    routine: Math.round(
      traits.sensitivity * 0.55 +
        (100 - traits.adaptability) * 0.35 +
        (100 - traits.playfulness) * 0.1,
    ),
    independence: Math.round(
      (100 - traits.sociability) * 0.55 +
        traits.sensitivity * 0.25 +
        (100 - traits.playfulness) * 0.2,
    ),
    adaptability: Math.round(
      traits.sensitivity * 0.45 +
        (100 - traits.adaptability) * 0.35 +
        (100 - traits.boldness) * 0.2,
    ),
  };
}

function goodFitCopy(dimension: keyof InteractionProfile, catName: string): string {
  const copies: Record<keyof InteractionProfile, string> = {
    interaction: `${withJosa(catName, "이/가")} 편안해하는 교감의 거리와 집사님의 표현 방식이 잘 맞아요.`,
    stimulation: `놀이의 속도와 새로움을 즐기는 정도가 비슷해 함께 재미를 찾기 좋아요.`,
    routine: `서로 기대하는 하루의 리듬이 비슷해 안정적인 생활을 만들기 좋아요.`,
    independence: `함께하는 시간과 각자 쉬는 시간의 균형이 자연스럽게 맞아요.`,
    adaptability: `변화가 생겼을 때 서로의 속도를 존중하며 조정하기 좋은 조합이에요.`,
  };
  return copies[dimension];
}

function adjustmentCopy(dimension: keyof InteractionProfile, catName: string): string {
  const copies: Record<keyof InteractionProfile, string> = {
    interaction: `${withJosa(catName, "이/가")} 먼저 다가올 때 교감하고, 물러나면 잠시 기다려 주세요.`,
    stimulation: `놀이 강도는 ${catName}의 호흡과 꼬리 움직임을 보며 한 단계씩 맞춰주세요.`,
    routine: `집사의 일정이 달라지는 날에도 식사와 휴식의 기준점은 지켜주세요.`,
    independence: `애정 표현 사이에 방해받지 않는 혼자만의 회복 시간을 넣어주세요.`,
    adaptability: `새로운 물건과 경험은 기존 환경 옆에서 작게 시작해 주세요.`,
  };
  return copies[dimension];
}

function livingTip(traits: TraitScores): string {
  if (traits.sensitivity >= 68) {
    return "새로운 놀이나 생활 변화는 한 번에 바꾸기보다 익숙한 것에 하나씩 더해보세요.";
  }
  if (traits.playfulness >= 68 || traits.activity >= 68) {
    return "매일 짧은 사냥 놀이를 여러 번 하고, 마지막에는 잡는 성공 경험과 휴식을 연결해 주세요.";
  }
  if (traits.sociability <= 38) {
    return "같은 공간에 조용히 머무르는 것부터 시작하면 스킨십보다 편안한 신뢰가 먼저 쌓여요.";
  }
  if (traits.adaptability <= 38) {
    return "식사와 놀이의 시간을 일정하게 두고 변화가 필요한 날은 냄새와 물건부터 미리 익혀주세요.";
  }
  return "하루 한 번은 고양이가 놀이·휴식·교감 중 원하는 것을 직접 고르게 해주세요.";
}

export function calculateCompatibility(
  mbti: HumanMbti,
  traits: TraitScores,
  catName = "고양이",
): CompatibilityResult {
  const human = HUMAN_MBTI_PROFILES[mbti];
  const cat = catTraitsToInteractionNeeds(traits);
  const differences = DIMENSIONS.map((dimension) => ({
    dimension,
    difference: Math.abs(human[dimension] - cat[dimension]),
  }));
  const dimensionWeights: Record<keyof InteractionProfile, number> = {
    interaction: 0.25,
    stimulation: 0.25,
    routine: 0.2,
    independence: 0.15,
    adaptability: 0.15,
  };
  const weightedDistance = differences.reduce(
    (sum, item) => sum + item.difference * dimensionWeights[item.dimension],
    0,
  );
  const score = Math.round(clamp(100 - weightedDistance * 0.55, 45, 97));
  const best = [...differences].sort((a, b) => a.difference - b.difference)[0].dimension;
  const needsCare = [...differences].sort((a, b) => b.difference - a.difference)[0].dimension;

  return {
    score,
    title: `${withJosa(DIMENSION_LABELS[best], "이/가")} 잘 통하는 우리`,
    goodFit: goodFitCopy(best, catName),
    adjustment: adjustmentCopy(needsCare, catName),
    tip: livingTip(traits),
  };
}
