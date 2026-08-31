import type { TraitScores } from "@/types/nyangbti";
import { withJosa } from "@/lib/korean";

export interface HarmonyDimension {
  key: "social" | "energy" | "change" | "sensitivity";
  icon: string;
  label: string;
  description: string;
  lowLabel: string;
  highLabel: string;
  first: number;
  second: number;
  difference: number;
  firstReading: HarmonyReading;
  secondReading: HarmonyReading;
  comparison: string;
  tip: string;
}

export interface HarmonyReading {
  level: "낮음" | "중간" | "높음";
  title: string;
  description: string;
}

export interface HarmonyCareGuide {
  name: string;
  summary: string;
  cautions: string[];
}

export interface CatHarmonyOptions {
  firstName?: string;
  secondName?: string;
}

const roundedAverage = (...values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const level = (value: number) => value >= 67 ? "high" : value <= 33 ? "low" : "middle";

type HarmonyDimensionKey = HarmonyDimension["key"];

const dimensionMeta: Record<HarmonyDimensionKey, Pick<HarmonyDimension, "icon" | "label" | "description" | "lowLabel" | "highLabel">> = {
  social: {
    icon: "♡",
    label: "교류 욕구",
    description: "상대에게 다가가 함께 머무르려는 빈도와 혼자 쉬려는 필요를 비교해요.",
    lowLabel: "혼자 회복",
    highLabel: "먼저 다가감",
  },
  energy: {
    icon: "↗",
    label: "활동 · 놀이",
    description: "움직임과 사냥 놀이를 원하는 빈도·강도, 쉬는 리듬을 비교해요.",
    lowLabel: "느긋한 휴식",
    highLabel: "자주 움직임",
  },
  change: {
    icon: "⌂",
    label: "변화 적응",
    description: "낯선 공간·물건·생활 루틴을 살피고 받아들이는 속도를 비교해요.",
    lowLabel: "익숙함 우선",
    highLabel: "새 환경 탐색",
  },
  sensitivity: {
    icon: "◉",
    label: "자극 민감도",
    description: "소리·움직임·접촉 같은 작은 자극을 알아차리고 반응하는 정도예요.",
    lowLabel: "자극에 여유",
    highLabel: "빠르게 감지",
  },
};

function buildReading(key: HarmonyDimensionKey, name: string, score: number): HarmonyReading {
  const scoreLevel = level(score);
  const copy: Record<HarmonyDimensionKey, Record<ReturnType<typeof level>, Omit<HarmonyReading, "level">>> = {
    social: {
      low: { title: "혼자 회복하는 편", description: `${withJosa(name, "은/는")} 먼저 다가가기보다 안전한 자리에서 상황을 보고, 접촉 뒤에는 혼자 쉴 시간을 원할 수 있어요.` },
      middle: { title: "상황을 보며 교류", description: `${withJosa(name, "은/는")} 편안할 때는 가까이 머물지만, 피곤하거나 낯선 순간에는 거리를 두며 교류량을 조절해요.` },
      high: { title: "먼저 다가가는 편", description: `${withJosa(name, "은/는")} 냄새 맡기·따라가기·곁에 눕기처럼 상대와 접점을 자주 만들려는 경향이 있어요.` },
    },
    energy: {
      low: { title: "휴식이 긴 편", description: `${withJosa(name, "은/는")} 오래 쉬고 짧게 움직이는 리듬이 편해요. 빠른 추격 놀이가 길어지면 자리를 피할 수 있어요.` },
      middle: { title: "놀이와 휴식이 균형", description: `${withJosa(name, "은/는")} 짧은 놀이 뒤 쉬는 시간을 가지며, 상대의 움직임에 따라 활동 강도를 조절하는 편이에요.` },
      high: { title: "움직임을 자주 원해요", description: `${withJosa(name, "은/는")} 달리기·추격·사냥 놀이를 자주 시도해요. 에너지가 남으면 상대에게 놀이를 걸 수 있어요.` },
    },
    change: {
      low: { title: "익숙함이 먼저", description: `${withJosa(name, "은/는")} 새 물건이나 동선 변화를 충분히 살핀 뒤 접근해요. 냄새와 자원 위치가 유지될 때 안정감을 느껴요.` },
      middle: { title: "확인한 뒤 적응", description: `${withJosa(name, "은/는")} 낯선 변화를 바로 피하거나 덤비기보다, 안전한지 확인하며 자기 속도로 받아들여요.` },
      high: { title: "새로움을 먼저 탐색", description: `${withJosa(name, "은/는")} 새 공간과 물건을 비교적 빠르게 살펴봐요. 공용 자원에도 먼저 접근할 가능성이 있어요.` },
    },
    sensitivity: {
      low: { title: "자극에 비교적 여유", description: `${withJosa(name, "은/는")} 일상적인 소리와 움직임에 반응이 크지 않을 수 있어요. 상대의 작은 거절 신호도 지나칠 수 있어요.` },
      middle: { title: "자극에 따라 조절", description: `${withJosa(name, "은/는")} 익숙한 자극은 넘기지만 갑작스럽거나 반복되는 소리·접촉에는 거리를 둘 수 있어요.` },
      high: { title: "작은 변화도 빠르게 감지", description: `${withJosa(name, "은/는")} 발소리·시선·꼬리 움직임 같은 작은 자극도 빨리 알아차려 긴장하거나 피할 수 있어요.` },
    },
  };

  return { level: scoreLevel === "high" ? "높음" : scoreLevel === "low" ? "낮음" : "중간", ...copy[key][scoreLevel] };
}

function buildTogetherCopy(key: HarmonyDimensionKey, firstName: string, secondName: string, firstScore: number, secondScore: number) {
  const difference = Math.abs(firstScore - secondScore);
  if (difference < 16) {
    const similar: Record<HarmonyDimensionKey, { comparison: string; tip: string }> = {
      social: {
        comparison: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 서로 다가가고 물러나는 속도가 비슷해 큰 압박 없이 교류하기 쉬워요. 그래도 그날의 컨디션에 따라 한쪽이 먼저 쉬고 싶을 수 있어요.`,
        tip: "한쪽이 고개를 돌리거나 자리를 뜨면 따라가지 않게 해주세요. 붙어 쉬는 자리와 따로 숨는 자리를 모두 마련하면 좋아요.",
      },
      energy: {
        comparison: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 놀이를 원하는 강도와 쉬는 주기가 비슷해 함께 움직이는 시간을 맞추기 쉬워요.`,
        tip: "같이 놀 때도 장난감은 두 방향으로 움직여 경쟁을 줄이고, 놀이가 끝난 뒤 각자 쉴 자리를 남겨주세요.",
      },
      change: {
        comparison: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 낯선 변화에 적응하는 속도가 비슷해 환경 전환 때 보폭을 맞추기 쉬워요.`,
        tip: "새 물건은 공용 생활 구역 한가운데보다 바깥쪽에 두고, 두 고양이가 각자 냄새 맡고 물러날 수 있게 해주세요.",
      },
      sensitivity: {
        comparison: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 자극을 알아차리는 정도가 비슷해 서로의 반응을 예측하기 비교적 쉬워요.`,
        tip: "반복 응시·꼬리 세게 흔들기·귀 젖힘이 보이면 비슷한 성향이어도 긴장이 오른 신호이니 시야를 나눠주세요.",
      },
    };
    return similar[key];
  }

  const highName = firstScore >= secondScore ? firstName : secondName;
  const lowName = firstScore >= secondScore ? secondName : firstName;
  const different: Record<HarmonyDimensionKey, { comparison: string; tip: string }> = {
    social: {
      comparison: `${withJosa(highName, "은/는")} 먼저 다가가거나 곁에 머물려 하고, ${withJosa(lowName, "은/는")} 혼자 회복할 시간을 더 원할 수 있어요. 따라가기와 피하기가 반복되면 교류가 아니라 압박이 될 수 있어요.`,
      tip: `${withJosa(lowName, "이/가")} 막힘없이 빠질 수 있는 높은 동선과 숨숨집을 두 곳 이상 마련하세요. ${withJosa(highName, "이/가")} 계속 따라붙으면 낚싯대 놀이나 간식 찾기로 관심을 돌려주세요.`,
    },
    energy: {
      comparison: `${withJosa(highName, "은/는")} 놀이를 더 오래 이어가려 하고, ${withJosa(lowName, "은/는")} 먼저 쉬려 할 수 있어요. 이 차이가 반복 추격이나 휴식 방해로 보일 수 있어요.`,
      tip: `${highName}의 에너지를 하루 여러 번 단독 놀이로 먼저 풀어주세요. ${lowName}의 잠자리 주변에서는 추격이 시작되지 않도록 장난감 방향을 바꿔주세요.`,
    },
    change: {
      comparison: `${withJosa(highName, "은/는")} 새 환경을 먼저 탐색하지만, ${withJosa(lowName, "은/는")} 익숙한 냄새와 동선을 확인한 뒤 움직이려 해요. 먼저 적응한 쪽이 공용 자원을 선점할 수 있어요.`,
      tip: `${lowName}의 식기·화장실·숨는 자리 위치는 유지하고 새 물건은 멀리서부터 소개하세요. ${highName}와 마주치지 않고도 자원에 가는 별도 동선을 남겨주세요.`,
    },
    sensitivity: {
      comparison: `${withJosa(highName, "은/는")} 작은 소리와 움직임에도 먼저 긴장할 수 있지만, ${withJosa(lowName, "은/는")} 그 신호를 알아차리지 못하고 계속 접근할 수 있어요.`,
      tip: `${highName}에게 소리와 발길이 적은 전용 피난처를 보장하세요. 귀 젖힘·몸 낮추기·꼬리 흔들기가 보이면 ${lowName}의 접근을 잠시 끊어주세요.`,
    },
  };
  return different[key];
}

function buildDimension(key: HarmonyDimensionKey, firstName: string, secondName: string, firstScore: number, secondScore: number): HarmonyDimension {
  const firstValue = Math.round(firstScore);
  const secondValue = Math.round(secondScore);
  return {
    key,
    ...dimensionMeta[key],
    first: firstValue,
    second: secondValue,
    difference: Math.abs(firstValue - secondValue),
    firstReading: buildReading(key, firstName, firstValue),
    secondReading: buildReading(key, secondName, secondValue),
    ...buildTogetherCopy(key, firstName, secondName, firstValue, secondValue),
  };
}

function buildCareGuide(name: string, traits: TraitScores): HarmonyCareGuide {
  const cautions: string[] = [];
  if (level(traits.sociability) === "high") cautions.push(`${withJosa(name, "이/가")} 먼저 다가가더라도 다른 고양이를 숨는 곳이나 쉬는 자리까지 따라가 공간을 차지하지 않는지 살펴봐 주세요.`);
  if (level(traits.sociability) === "low") cautions.push(`${name}에게는 혼자 머물 수 있는 자리와 먼저 물러날 동선을 남겨두고, 접촉을 서두르지 마세요.`);
  if (level(traits.activity) === "high" || level(traits.playfulness) === "high") cautions.push(`${name}의 놀이 에너지는 하루 여러 번 짧게 풀어주고, 다른 고양이를 쫓는 행동이 놀이로 굳어지지 않게 전환해 주세요.`);
  if (level(traits.activity) === "low" && level(traits.playfulness) === "low") cautions.push(`${withJosa(name, "이/가")} 쉬는 시간에는 갑작스러운 놀이 유도보다 조용히 관찰하고, 짧고 부담 없는 활동부터 제안해 주세요.`);
  if (level(traits.boldness) === "low" || level(traits.adaptability) === "low") cautions.push(`${name}의 식기·화장실·숨는 장소 위치는 한꺼번에 바꾸지 말고, 새 환경은 냄새와 시야부터 천천히 익히게 해주세요.`);
  if (level(traits.boldness) === "high" && level(traits.adaptability) === "high") cautions.push(`${withJosa(name, "이/가")} 새 공간과 자원을 먼저 차지할 수 있으니, 다른 고양이도 방해받지 않고 접근하는지 확인해 주세요.`);
  if (level(traits.sensitivity) === "high") cautions.push(`${withJosa(name, "은/는")} 소리와 움직임에 긴장할 수 있어요. 조용한 피난처와 높은 관찰 자리를 생활 구역마다 마련해 주세요.`);
  if (level(traits.sensitivity) === "low") cautions.push(`${withJosa(name, "이/가")} 상대의 경고 신호를 놓치지 않도록 응시·길막·꼬리 흔들기 같은 작은 신호가 보이면 보호자가 개입해 행동을 끊어 주세요.`);

  if (cautions.length < 2) {
    cautions.push(`${withJosa(name, "이/가")} 밥, 물, 화장실, 잠자리에 평소처럼 접근하는지 매일 살펴보고 작은 변화도 기록해 주세요.`);
  }

  const energy = roundedAverage(traits.activity, traits.playfulness);
  const change = roundedAverage(traits.boldness, traits.adaptability);
  const summary = energy >= 67
    ? "움직임과 놀이 욕구를 충분히 풀어준 뒤 차분한 교류를 돕는 편이 좋아요."
    : change <= 33 || traits.sensitivity >= 67
      ? "예측 가능한 일상과 스스로 거리를 정할 수 있는 선택지가 중요해요."
      : "평소 생활 리듬을 지키면서 상대의 반응에 맞춰 교류 강도를 조절해 주세요.";
  return { name, summary, cautions: cautions.slice(0, 3) };
}

export function calculateCatHarmony(first: TraitScores, second: TraitScores, options: CatHarmonyOptions = {}) {
  const firstName = options.firstName ?? "첫 번째 고양이";
  const secondName = options.secondName ?? "두 번째 고양이";
  const firstEnergy = roundedAverage(first.activity, first.playfulness);
  const secondEnergy = roundedAverage(second.activity, second.playfulness);
  const firstChange = roundedAverage(first.boldness, first.adaptability);
  const secondChange = roundedAverage(second.boldness, second.adaptability);
  const dimensions: HarmonyDimension[] = [
    buildDimension("social", firstName, secondName, first.sociability, second.sociability),
    buildDimension("energy", firstName, secondName, firstEnergy, secondEnergy),
    buildDimension("change", firstName, secondName, firstChange, secondChange),
    buildDimension("sensitivity", firstName, secondName, first.sensitivity, second.sensitivity),
  ];
  const averageDifference = roundedAverage(...dimensions.map((item) => item.difference));
  const score = Math.max(40, Math.round(100 - averageDifference * 0.72));
  const title = averageDifference < 16 ? "비슷한 리듬을 가진 동료" : averageDifference < 31 ? "다름을 알아가면 좋은 조합" : "각자의 속도를 존중할 조합";
  const sharedTips: string[] = [];
  const socialDifference = Math.abs(first.sociability - second.sociability);
  const energyDifference = Math.abs(firstEnergy - secondEnergy);
  const changeDifference = Math.abs(firstChange - secondChange);
  const sensitivityDifference = Math.abs(first.sensitivity - second.sensitivity);
  if (socialDifference >= 20) sharedTips.push(`교류 속도는 더 조심스러운 고양이에게 맞추고, ${withJosa(firstName, "과/와")} ${withJosa(secondName, "이/가")} 서로 피할 수 있는 동선을 열어두세요.`);
  if (energyDifference >= 20) sharedTips.push("놀이 시간과 강도를 따로 맞춘 뒤, 함께 있는 시간에는 간식 찾기처럼 경쟁이 적은 활동을 활용해 보세요.");
  if (changeDifference >= 20) sharedTips.push("가구 이동이나 새 물건은 더 신중한 고양이의 생활 구역에서 멀리 두고 단계적으로 소개해 주세요.");
  if (sensitivityDifference >= 20) sharedTips.push("더 민감한 고양이가 편히 쉴 수 있도록 소리와 움직임이 적은 전용 피난처를 보장해 주세요.");
  if (sharedTips.length < 2) sharedTips.push("생활 리듬이 비슷해도 밥·물·화장실·휴식 자리는 각각 선택할 수 있도록 분산해 주세요.");

  return {
    score,
    title,
    dimensions,
    careGuides: [buildCareGuide(firstName, first), buildCareGuide(secondName, second)],
    sharedTips: sharedTips.slice(0, 3),
    commonCautions: [
      "밥그릇과 물그릇은 서로 시야가 겹치지 않는 곳에도 나눠 놓아주세요.",
      "화장실은 고양이 수보다 하나 더 두는 방식을 고려하고, 서로 다른 동선에 분산해 주세요.",
      "응시, 길막, 반복 추격, 식욕·배변 변화가 이어지면 억지로 가까이 두지 말고 수의사나 고양이 행동 전문가와 상의해 주세요.",
    ],
  };
}
