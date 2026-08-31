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
      middle: { title: "놀이와 휴식이 균형", description: `${withJosa(name, "은/는")} 짧게 놀고 쉬는 시간을 번갈아 가지는 편이에요. 놀이가 너무 길어지지만 않으면 안정적인 리듬을 유지해요.` },
      high: { title: "움직임을 자주 원해요", description: `${withJosa(name, "은/는")} 달리기·추격·사냥 놀이를 자주 시도해요. 에너지가 남으면 상대에게 놀이를 걸 수 있어요.` },
    },
    change: {
      low: { title: "익숙함이 먼저", description: `${withJosa(name, "은/는")} 새 물건이나 동선 변화를 충분히 살핀 뒤 접근해요. 냄새와 자원 위치가 유지될 때 안정감을 느껴요.` },
      middle: { title: "확인한 뒤 적응", description: `${withJosa(name, "은/는")} 낯선 변화가 생기면 먼저 살펴본 뒤, 안전하다고 느끼는 만큼 자기 속도로 받아들여요.` },
      high: { title: "새로움을 먼저 탐색", description: `${withJosa(name, "은/는")} 새 공간과 물건을 비교적 빠르게 살펴봐요. 공용 자원에도 다른 고양이보다 먼저 다가갈 수 있어요.` },
    },
    sensitivity: {
      low: { title: "일상 자극에 비교적 여유", description: `${withJosa(name, "은/는")} 익숙한 소리와 주변 움직임에 반응이 크지 않은 편이에요. 작은 변화가 생겨도 평소 리듬을 이어갈 수 있어요.` },
      middle: { title: "자극에 따라 조절", description: `${withJosa(name, "은/는")} 익숙한 자극은 넘기지만 갑작스럽거나 반복되는 소리·접촉에는 거리를 둘 수 있어요.` },
      high: { title: "작은 변화도 빠르게 감지", description: `${withJosa(name, "은/는")} 발소리·시선·꼬리 움직임 같은 작은 자극도 빨리 알아차려, 멈추거나 자리를 옮기는 반응을 보일 수 있어요.` },
    },
  };

  return { level: scoreLevel === "high" ? "높음" : scoreLevel === "low" ? "낮음" : "중간", ...copy[key][scoreLevel] };
}

function buildTogetherCopy(key: HarmonyDimensionKey, firstName: string, secondName: string, firstScore: number, secondScore: number) {
  const difference = Math.abs(firstScore - secondScore);
  if (difference < 16) {
    const pairLevel = level(roundedAverage(firstScore, secondScore));
    const similarComparison: Record<HarmonyDimensionKey, Record<ReturnType<typeof level>, string>> = {
      social: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 먼저 다가가기보다 각자의 자리에서 안정감을 찾는 편이에요. 가까이 붙어 있지 않아도 같은 공간에서 편히 쉬는 것이 둘만의 교류일 수 있어요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 함께 머무는 시간과 혼자 쉬는 시간을 비슷한 간격으로 조절해요. 한쪽이 자리를 뜨면 자연스럽게 쉬는 시간으로 받아들이기 쉬운 조합이에요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 서로 곁에 머물거나 놀이를 거는 일이 잦을 수 있어요. 교류가 활발한 만큼 한쪽이 쉬고 싶어 하는 순간만 놓치지 않으면 좋아요.`,
      },
      energy: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 긴 놀이보다 조용한 휴식을 선호해 생활 속도가 잘 맞아요. 활동이 적어 보여도 각자의 짧은 놀이 기회는 필요해요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 짧게 놀고 쉬는 주기가 비슷해 함께 움직이는 시간을 맞추기 쉬워요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 움직임과 놀이를 자주 원해 함께 활발하게 지낼 수 있어요. 흥분이 길어져 추격으로 바뀌는 순간은 살펴봐 주세요.`,
      },
      change: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 익숙한 냄새와 동선이 유지될 때 편안해요. 환경을 천천히 바꾸면 서로 비슷한 속도로 적응할 수 있어요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 낯선 변화를 먼저 살핀 뒤 받아들이는 속도가 비슷해요. 각자 확인할 시간만 주면 환경 전환의 보폭을 맞추기 쉬워요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 새 공간과 물건을 비교적 빠르게 살피는 편이에요. 동시에 같은 자원으로 향할 수 있으니 접근 경로를 나눠주세요.`,
      },
      sensitivity: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 일상적인 소리와 움직임에 모두 비교적 차분하게 반응해요. 다만 반응이 작더라도 불편 신호가 없는 것은 아니니 몸의 변화를 함께 봐주세요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 익숙한 자극과 낯선 자극을 구분해 반응하는 정도가 비슷해 서로의 생활 리듬을 예측하기 쉬워요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 작은 소리와 움직임도 빠르게 알아차리는 편이에요. 한쪽의 갑작스러운 반응이 다른 쪽의 반응으로 이어지지 않게 조용한 피난처가 필요해요.`,
      },
    };
    const similarTips: Record<HarmonyDimensionKey, string> = {
      social: "한쪽이 고개를 돌리거나 자리를 뜨면 그 순간에는 교류를 쉬고 싶다는 신호로 봐주세요. 함께 쉬는 자리와 혼자 숨는 자리를 모두 마련하면 좋아요.",
      energy: "같이 놀 때 장난감은 두 방향으로 움직여 경쟁을 줄이고, 놀이가 끝난 뒤에는 각자 방해받지 않고 쉴 자리를 남겨주세요.",
      change: "새 물건은 공용 생활 구역 한가운데보다 바깥쪽에 두고, 두 고양이가 각자 냄새를 맡은 뒤 물러날 수 있게 해주세요.",
      sensitivity: "반복 응시·귀 젖힘·꼬리 세게 흔들기처럼 긴장이 높아지는 신호가 보이면 가림막이나 가구로 시야를 잠시 나눠주세요.",
    };
    return { comparison: similarComparison[key][pairLevel], tip: similarTips[key] };
  }

  const highName = firstScore >= secondScore ? firstName : secondName;
  const lowName = firstScore >= secondScore ? secondName : firstName;
  const different: Record<HarmonyDimensionKey, { comparison: string; tip: string }> = {
    social: {
      comparison: `${withJosa(highName, "이/가")} 상대적으로 교류 신호를 더 자주 보낼 때, ${withJosa(lowName, "은/는")} 한 번의 교류 뒤 쉬는 간격을 더 길게 둘 수 있어요. ${withJosa(lowName, "이/가")} 물러난 뒤에도 따라가기와 피하기가 반복되면 부담이 될 수 있어요.`,
      tip: `${withJosa(lowName, "이/가")} 막힘없이 빠질 수 있는 높은 동선과 숨숨집을 두 곳 이상 마련하세요. ${withJosa(highName, "이/가")} 뒤따르기 시작하면 낚싯대 놀이나 간식 찾기로 자연스럽게 관심을 돌려주세요.`,
    },
    energy: {
      comparison: `${withJosa(highName, "이/가")} 놀이를 조금 더 이어가고 싶을 때, ${withJosa(lowName, "은/는")} 먼저 쉬는 자리로 갈 수 있어요. 이때 계속 놀이를 걸면 반복 추격이나 휴식 방해로 이어질 수 있어요.`,
      tip: `${highName}에게 하루 여러 번 단독 놀이 시간을 먼저 제공해 주세요. ${lowName}의 잠자리 가까이에서 추격이 시작되면 장난감을 반대 방향으로 움직여 동선을 분리하세요.`,
    },
    change: {
      comparison: `${withJosa(highName, "이/가")} 변화된 공간을 먼저 확인하는 동안, ${withJosa(lowName, "은/는")} 익숙한 자리에 머물며 조금 더 오래 살필 수 있어요. 먼저 움직인 고양이가 새 물건이나 공용 자원 앞에 머물면 다른 고양이의 접근이 늦어질 수 있어요.`,
      tip: `${lowName}의 식기·화장실·숨는 자리 위치는 유지하고 새 물건은 생활 구역에서 떨어진 곳부터 소개하세요. ${highName}와 마주치지 않고도 자원에 갈 수 있는 별도 동선을 남겨주세요.`,
    },
    sensitivity: {
      comparison: `${withJosa(highName, "이/가")} 같은 소리나 움직임에 먼저 반응해 멈추거나 자리를 옮길 때, ${withJosa(lowName, "은/는")} 반응이 더 작거나 늦을 수 있어요. 반응의 크기가 다를 뿐 어느 한쪽이 더 편안하다는 뜻은 아니에요.`,
      tip: `${highName}에게 소리와 발길이 적은 전용 피난처를 보장하세요. 귀 젖힘·몸 낮추기·꼬리 흔들기처럼 불편 신호가 보이면 ${lowName}의 접근을 잠시 끊어주세요.`,
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
  if (level(traits.boldness) === "high" && level(traits.adaptability) === "high") cautions.push(`${withJosa(name, "이/가")} 새 공간과 자원에 먼저 접근할 수 있으니, 다른 고양이도 방해받지 않고 이용하는지 확인해 주세요.`);
  if (level(traits.sensitivity) === "high") cautions.push(`${withJosa(name, "은/는")} 소리와 움직임에 빠르게 반응할 수 있어요. 조용한 피난처와 높은 관찰 자리를 생활 구역마다 마련해 주세요.`);
  if (level(traits.sensitivity) === "low") cautions.push(`${withJosa(name, "은/는")} 일상 자극에 반응이 작을 수 있어요. 상대가 응시하거나 귀를 젖히고 꼬리를 세게 흔들 때는 교류를 잠시 끊어 주세요.`);

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
  const moreSocialName = first.sociability >= second.sociability ? firstName : secondName;
  const lessSocialName = first.sociability >= second.sociability ? secondName : firstName;
  const moreActiveName = firstEnergy >= secondEnergy ? firstName : secondName;
  const lessActiveName = firstEnergy >= secondEnergy ? secondName : firstName;
  const fasterChangeName = firstChange >= secondChange ? firstName : secondName;
  const slowerChangeName = firstChange >= secondChange ? secondName : firstName;
  const moreSensitiveName = first.sensitivity >= second.sensitivity ? firstName : secondName;
  if (socialDifference >= 20) sharedTips.push(`${withJosa(lessSocialName, "이/가")} 자리를 뜨면 그 순간에는 교류를 쉬고 싶다는 신호로 보고, ${withJosa(moreSocialName, "이/가")} 뒤따르지 않도록 놀이로 관심을 돌려주세요.`);
  if (energyDifference >= 20) sharedTips.push(`${moreActiveName}에게는 별도의 놀이 시간을 충분히 제공하고, ${lessActiveName}의 휴식 자리 주변에서는 추격 놀이를 피해 주세요.`);
  if (changeDifference >= 20) sharedTips.push(`환경 변화는 ${slowerChangeName}의 속도에 맞춰 단계적으로 진행하고, ${fasterChangeName}와 마주치지 않고도 기존 자원에 갈 수 있게 해주세요.`);
  if (sensitivityDifference >= 20) sharedTips.push(`${moreSensitiveName}에게 소리와 움직임이 적은 전용 피난처를 마련하고, 불편 신호가 보이면 두 고양이의 시야를 잠시 나눠주세요.`);
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
