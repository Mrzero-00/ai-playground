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
  stimulation: "놀이 방식과 강도",
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

const profileLevel = (value: number) => value >= 67 ? "high" : value <= 33 ? "low" : "middle";

const FIT_CHECKS: Record<keyof InteractionProfile, (catName: string) => string> = {
  interaction: (catName) => `실제로는 ${withJosa(catName, "이/가")} 먼저 다가온 뒤 얼마나 오래 머무는지, 물러났을 때 집사님이 기다려 줄 수 있는지를 함께 보면 두 사람의 편안한 거리를 더 정확히 알 수 있어요.`,
  stimulation: (catName) => `놀이를 시작한 뒤 ${withJosa(catName, "이/가")} 장난감을 계속 따라오는지, 중간에 자리를 뜨는지를 살피면 알맞은 속도와 길이를 찾기 쉬워요.`,
  routine: (catName) => `${catName}의 식사·놀이·잠자는 시간이 며칠 동안 비슷하게 유지되는지 살펴보세요. 집사님의 일정이 달라진 날에도 이 생활이 크게 흔들리지 않으면 현재 방식이 잘 맞는 편이에요.`,
  independence: (catName) => `${withJosa(catName, "이/가")} 혼자 쉬다가 스스로 다시 곁으로 오는지 확인해 보세요. 집사님과 떨어져 있는 시간 뒤에도 편안하게 먹고 자면 휴식 간격이 잘 맞는 편이에요.`,
  adaptability: (catName) => `새 물건이나 일정이 생긴 날 ${withJosa(catName, "이/가")} 냄새를 맡고 평소 자리로 돌아오는 데 얼마나 걸리는지 살펴보세요. 그 시간이 길어지면 변화의 크기를 더 작게 나누면 돼요.`,
};

function goodFitCopy(
  dimension: keyof InteractionProfile,
  catName: string,
  humanValue: number,
  catValue: number,
): string {
  if (Math.abs(humanValue - catValue) > 30) {
    return `${withJosa(DIMENSION_LABELS[dimension], "은/는")} 다섯 생활 항목 중 차이가 가장 작지만, 서로 비슷하다고 보기에는 아직 간격이 있어요. 아래 조정점을 먼저 적용해 보세요. ${FIT_CHECKS[dimension](catName)}`;
  }
  const pairLevel = profileLevel((humanValue + catValue) / 2);
  const copies: Record<keyof InteractionProfile, Record<ReturnType<typeof profileLevel>, string>> = {
    interaction: {
      low: `집사님은 교감을 재촉하지 않는 편이고, ${catName}도 혼자 쉬는 시간을 충분히 필요로 해 거리감이 비교적 가까워요.`,
      middle: `${withJosa(catName, "이/가")} 사람 곁에 머물고 싶어 하는 시간과 집사님이 애정을 표현하는 빈도가 비교적 비슷해요.`,
      high: `집사님은 애정을 자주 표현하고, ${catName}도 사람 곁에 머물며 관심을 주고받는 시간을 자주 원해요.`,
    },
    stimulation: {
      low: `집사님과 ${withJosa(catName, "은/는")} 모두 익숙하고 천천히 진행하는 놀이를 편안해하는 쪽에 가까워요.`,
      middle: `놀이 횟수와 새로운 장난감을 더하는 정도가 비슷해 무리 없이 함께 놀기 좋아요.`,
      high: `집사님이 준비하는 놀이의 속도와 강도, ${withJosa(catName, "이/가")} 원하는 활동량이 모두 높은 편이에요.`,
    },
    routine: {
      low: `${withJosa(catName, "은/는")} 일정 변화에 비교적 유연하고, 집사님도 고정된 일과를 덜 선호해 생활을 조정하기 쉬워요.`,
      middle: `식사·놀이·휴식 시간을 일정하게 지키려는 정도가 서로 비슷해요.`,
      high: `집사님이 지키려는 규칙적인 일과와 ${withJosa(catName, "이/가")} 필요로 하는 예측 가능성이 비교적 가까워요.`,
    },
    independence: {
      low: `집사님은 함께하는 시간을 선호하고, ${catName}도 교류를 자주 원하는 편이라 생활 방식이 가까워요.`,
      middle: `함께하는 시간과 각자 쉬는 시간을 나누는 정도가 서로 비슷해요.`,
      high: `집사님이 혼자만의 시간을 존중하는 편이고, ${catName}도 방해받지 않는 휴식을 중요하게 여겨요.`,
    },
    adaptability: {
      low: `${withJosa(catName, "은/는")} 변화에 비교적 유연해 돌봄 방식을 크게 조정하지 않아도 집사님과 리듬을 맞추기 쉬워요.`,
      middle: `집사님이 ${catName}의 반응을 보며 하나씩 바꾸는 편이라, ${withJosa(catName, "이/가")} 새 환경에 익숙해지는 속도와 비교적 잘 맞아요.`,
      high: `집사님은 변화를 서두르지 않는 편이고, ${catName}도 새 환경을 천천히 익히는 시간이 필요해 잘 맞아요.`,
    },
  };
  return `${copies[dimension][pairLevel]} ${FIT_CHECKS[dimension](catName)}`;
}

const ADJUSTMENT_CHECKS: Record<keyof InteractionProfile, string> = {
  interaction: "고개를 돌리거나 꼬리를 세게 흔들고 자리를 뜨면 그 순간에는 교감을 멈추고, 다시 먼저 다가올 때까지 기다려 주세요.",
  stimulation: "놀이 중 몸을 낮추거나 귀를 뒤로 젖히고 장난감을 피하면 속도를 늦추고, 그래도 반응하지 않으면 그날 놀이는 끝내 주세요.",
  routine: "시간을 바꾼 뒤 식사량·화장실 이용·수면이 평소와 달라지면 이전 시간으로 잠시 돌아가 한 번에 한 가지씩 다시 조정해 주세요.",
  independence: "혼자 있는 동안 먹고 자는 생활이 유지되는지, 집사님이 돌아왔을 때 울음이나 따라다니기가 갑자기 늘지 않는지 함께 살펴보세요.",
  adaptability: "새 물건을 피하거나 평소 쓰던 자리로 가지 않으면 더 멀리 옮기고, 기존 생활이 회복된 뒤 다시 천천히 시도해 주세요.",
};

function adjustmentCopy(
  dimension: keyof InteractionProfile,
  catName: string,
  humanValue: number,
  catValue: number,
): string {
  const difference = humanValue - catValue;
  if (Math.abs(difference) < 16) {
    return `이 부분의 차이는 크지 않아요. ${catName}의 그날 반응을 보며 지금의 생활 방식을 유지해 주세요. ${ADJUSTMENT_CHECKS[dimension]}`;
  }
  const humanHigher = difference > 0;
  const copies: Record<keyof InteractionProfile, { higher: string; lower: string }> = {
    interaction: {
      higher: `집사님의 애정 표현이 ${catName}에게는 많게 느껴질 수 있어요. ${withJosa(catName, "이/가")} 먼저 다가올 때 교감하고 물러나면 기다려 주세요.`,
      lower: `${withJosa(catName, "이/가")} 집사님이 예상한 것보다 사람 곁에 자주 머물고 싶어 할 수 있어요. 짧게 쓰다듬거나 함께 노는 시간을 하루에 여러 번 만들어 주세요.`,
    },
    stimulation: {
      higher: `집사님이 준비하는 놀이가 ${catName}에게는 빠르거나 낯설 수 있어요. 익숙한 장난감을 바닥 가까이에서 천천히 움직이며 시작해 주세요.`,
      lower: `${withJosa(catName, "이/가")} 더 자주 움직이고 놀고 싶어 할 수 있어요. 짧은 사냥 놀이를 하루 여러 번 일정에 넣어 주세요.`,
    },
    routine: {
      higher: `${withJosa(catName, "은/는")} 일정 변화에 비교적 유연할 수 있어요. 정한 시간이 되었더라도 쉬고 있다면 억지로 깨워 놀게 하지 말고, 스스로 움직일 때 시작해 주세요.`,
      lower: `${withJosa(catName, "은/는")} 집사님이 생각하는 것보다 예측 가능한 일과를 더 필요로 해요. 식사·놀이·휴식의 기준 시간을 지켜 주세요.`,
    },
    independence: {
      higher: `집사님이 혼자 쉬게 두는 시간이 ${catName}에게는 길 수 있어요. 먼저 다가오거나 따라오면 짧게라도 자주 쓰다듬거나 말을 걸어 주세요.`,
      lower: `${withJosa(catName, "은/는")} 집사님이 예상한 것보다 혼자 편히 쉴 시간이 더 필요해요. 쓰다듬거나 놀아 주는 시간 사이에 방해받지 않는 휴식 시간을 마련해 주세요.`,
    },
    adaptability: {
      higher: `${withJosa(catName, "은/는")} 변화에 비교적 유연할 수 있어요. 필요한 변화를 너무 오래 미루지 말고, 반응을 보면서 하나씩 진행해도 괜찮아요.`,
      lower: `${withJosa(catName, "은/는")} 집사님이 예상한 것보다 새 환경을 익히는 데 시간이 더 필요해요. 평소 쓰던 물건은 그대로 두고, 새 물건은 조금 떨어진 곳에 놓아 먼저 냄새 맡고 살피게 해 주세요.`,
    },
  };
  const copy = humanHigher ? copies[dimension].higher : copies[dimension].lower;
  return `${copy} ${ADJUSTMENT_CHECKS[dimension]}`;
}

function livingTip(traits: TraitScores): string {
  if (traits.sensitivity >= 68) {
    return "새로운 놀이나 생활 변화는 한 번에 바꾸기보다 익숙한 것에 하나씩 더해 보세요. 새 물건은 잠자리와 밥그릇에서 떨어진 곳에 두고, 먼저 냄새를 맡은 뒤 평소 행동으로 돌아오는지 확인해 주세요.";
  }
  if (traits.playfulness >= 68 || traits.activity >= 68) {
    return "매일 깨어 있는 시간에 짧은 사냥 놀이를 여러 번 하고, 마지막에는 장난감을 잡는 성공 경험과 간식 또는 식사를 연결해 주세요. 놀이 뒤에도 계속 달리거나 물려고 하면 다음 놀이는 더 짧게 진행해요.";
  }
  if (traits.sociability <= 38) {
    return "같은 공간에서 서로 다른 일을 하며 조용히 머무르는 것부터 시작하면 스킨십보다 편안한 신뢰가 먼저 쌓여요. 먼저 냄새를 맡거나 몸을 기대면 짧게 반응하고, 물러나면 따라가지 마세요.";
  }
  if (traits.adaptability <= 38) {
    return "식사와 놀이 시간을 일정하게 두고, 변화가 필요한 날에는 새 냄새와 물건을 평소 자리에서 떨어진 곳에 미리 두어 살피게 해 주세요. 식사·배변·휴식이 유지되는 것을 확인한 뒤 다음 변화를 진행해요.";
  }
  return "하루 한 번은 고양이가 놀이·휴식·교감 중 원하는 것을 직접 고르게 해 주세요. 장난감, 숨는 자리, 집사의 손을 동시에 가까이 대지 말고 각각 떨어뜨려 두면 무엇을 원하는지 더 분명하게 볼 수 있어요.";
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
  const bestMatch = [...differences].sort((a, b) => a.difference - b.difference)[0];
  const needsCareMatch = [...differences].sort((a, b) => b.difference - a.difference)[0];
  const best = bestMatch.dimension;
  const needsCare = needsCareMatch.dimension;

  return {
    score,
    title: `${withJosa(DIMENSION_LABELS[best], "이/가")} 가장 가까운 조합`,
    goodFit: goodFitCopy(best, catName, human[best], cat[best]),
    adjustment: adjustmentCopy(needsCare, catName, human[needsCare], cat[needsCare]),
    tip: livingTip(traits),
  };
}
