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

// 결과 화면의 6개 Trait 단계와 같은 경계를 사용해 화면마다 단계가 달라지지 않게 한다.
const level = (value: number) => value >= 65 ? "high" : value < 40 ? "low" : "middle";

type HarmonyDimensionKey = HarmonyDimension["key"];

const dimensionMeta: Record<HarmonyDimensionKey, Pick<HarmonyDimension, "icon" | "label" | "description" | "lowLabel" | "highLabel">> = {
  social: {
    icon: "♡",
    label: "사람과 지내는 거리",
    description: "사람과 지낼 때 관찰된 사회성을 바탕으로, 둘 사이에서도 비슷한 거리 차이가 보이는지 참고해요.",
    lowLabel: "혼자 쉬기",
    highLabel: "사람 곁 찾기",
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
    label: "소리·움직임 민감도",
    description: "작은 소리·주변 움직임·접촉을 얼마나 빨리 알아차리고 반응하는지 비교해요.",
    lowLabel: "반응이 적음",
    highLabel: "빠르게 알아챔",
  },
};

function buildReading(key: HarmonyDimensionKey, name: string, score: number): HarmonyReading {
  const scoreLevel = level(score);
  const copy: Record<HarmonyDimensionKey, Record<ReturnType<typeof level>, Omit<HarmonyReading, "level">>> = {
    social: {
      low: { title: "사람과 거리를 정하는 편", description: `${withJosa(name, "은/는")} 사람이 관심을 보여도 먼저 다가가기보다 안전한 자리에서 상황을 봐요. 쓰다듬거나 함께 논 뒤에는 혼자 쉴 시간을 원할 수 있어요.` },
      middle: { title: "상황을 보며 사람과 교류", description: `${withJosa(name, "은/는")} 편안할 때는 사람 가까이 머물지만, 피곤하거나 낯선 순간에는 거리를 두며 함께 있는 시간을 조절해요.` },
      high: { title: "사람 곁을 자주 찾는 편", description: `${withJosa(name, "은/는")} 사람에게 다가가거나 따라가고 곁에 눕는 행동을 자주 보여요.` },
    },
    energy: {
      low: { title: "휴식이 긴 편", description: `${withJosa(name, "은/는")} 오래 쉬고 짧게 움직이는 리듬이 편해요. 빠른 추격 놀이가 길어지면 자리를 피할 수 있어요.` },
      middle: { title: "놀이와 휴식이 균형", description: `${withJosa(name, "은/는")} 짧게 놀고 쉬는 시간을 번갈아 가지는 편이에요. 놀이가 너무 길어지지만 않으면 안정적인 리듬을 유지해요.` },
      high: { title: "움직임을 자주 원해요", description: `${withJosa(name, "은/는")} 달리기·추격·사냥 놀이를 자주 시도해요. 에너지가 남으면 다른 고양이를 쫓으며 놀자고 할 수 있어요.` },
    },
    change: {
      low: { title: "익숙함이 먼저", description: `${withJosa(name, "은/는")} 새 물건이 생기거나 가구 위치가 바뀌면 충분히 살핀 뒤 움직여요. 익숙한 냄새가 나고 밥그릇·화장실 위치가 그대로일 때 편안해해요.` },
      middle: { title: "확인한 뒤 적응", description: `${withJosa(name, "은/는")} 낯선 변화가 생기면 먼저 살펴본 뒤, 안전하다고 느끼는 만큼 자기 속도로 받아들여요.` },
      high: { title: "새로움을 먼저 탐색", description: `${withJosa(name, "은/는")} 새 공간과 물건을 비교적 빠르게 살펴봐요. 밥그릇·화장실·높은 자리에도 다른 고양이보다 먼저 다가갈 수 있어요.` },
    },
    sensitivity: {
      low: { title: "평소 소리에는 반응이 적은 편", description: `${withJosa(name, "은/는")} 익숙한 소리와 주변 움직임에 반응이 크지 않은 편이에요. 작은 변화가 생겨도 평소 생활을 이어갈 수 있어요.` },
      middle: { title: "소리와 움직임에 따라 반응", description: `${withJosa(name, "은/는")} 익숙한 소리나 움직임에는 편안하지만, 갑작스럽거나 반복되면 자리를 피할 수 있어요.` },
      high: { title: "작은 변화도 빠르게 알아채는 편", description: `${withJosa(name, "은/는")} 발소리·시선·꼬리 움직임 같은 작은 변화도 빨리 알아차려, 멈추거나 자리를 옮길 수 있어요.` },
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
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 사람과의 거리를 스스로 정하는 편이에요. 두 고양이 사이에서도 멀리 떨어져 편히 쉬는 모습이 보인다면 그것 역시 안정된 공존일 수 있어요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 사람 곁에 머무는 시간과 혼자 쉬는 시간이 비슷해요. 이 모습이 두 고양이 사이에서도 나타나는지는 실제로 다가가고 물러날 때의 반응을 함께 봐 주세요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 사람 곁을 자주 찾는 편이에요. 이 점만으로 둘 사이의 친밀도를 알 수는 없으니, 한쪽이 다가갈 때 다른 쪽이 편히 머무는지 따로 살펴봐 주세요.`,
      },
      energy: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 긴 놀이보다 조용한 휴식을 선호해 생활 속도가 잘 맞아요. 활동이 적어 보여도 각자의 짧은 놀이 기회는 필요해요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 짧게 놀고 쉬는 주기가 비슷해 함께 움직이는 시간을 맞추기 쉬워요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 움직임과 놀이를 자주 원해 함께 활발하게 지낼 수 있어요. 흥분이 길어져 추격으로 바뀌는 순간은 살펴봐 주세요.`,
      },
      change: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 모두 익숙한 냄새가 나고 가구·밥그릇·화장실 위치가 그대로일 때 편안해요. 한 번에 하나씩 천천히 바꾸면 비슷한 속도로 익숙해질 수 있어요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 낯선 변화를 먼저 살핀 뒤 받아들이는 속도가 비슷해요. 각자 충분히 둘러볼 시간을 주면 새 환경에 비슷한 속도로 익숙해질 수 있어요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 새 공간과 물건을 비교적 빠르게 살피는 편이에요. 둘이 동시에 새 물건으로 다가가더라도 서로 길을 막지 않도록 주변에 돌아 나갈 공간을 남겨 주세요.`,
      },
      sensitivity: {
        low: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 평소 소리와 움직임에 모두 비교적 차분하게 반응해요. 반응이 작다고 해서 항상 편안한 것은 아니니 귀·꼬리·몸 자세도 함께 봐 주세요.`,
        middle: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 평소 듣던 소리와 낯선 소리를 구분해 반응하는 정도가 비슷해 서로의 행동을 예상하기 쉬워요.`,
        high: `${withJosa(firstName, "과/와")} ${withJosa(secondName, "은/는")} 작은 소리와 움직임도 빠르게 알아차리는 편이에요. 한쪽이 놀랐을 때 다른 쪽도 함께 긴장하지 않도록 각자 숨을 수 있는 조용한 자리가 필요해요.`,
      },
    };
    const similarTips: Record<HarmonyDimensionKey, string> = {
      social: "한쪽이 고개를 돌리거나 자리를 뜨면 혼자 쉬고 싶다는 뜻으로 봐 주세요. 함께 쉬는 자리와 각자 숨는 자리를 모두 마련하면 좋아요.",
      energy: "같이 놀 때 장난감은 두 방향으로 움직여 경쟁을 줄이고, 놀이가 끝난 뒤에는 각자 방해받지 않고 쉴 자리를 남겨 주세요.",
      change: "새 물건은 두 고양이가 자주 지나는 길 한가운데에 놓지 마세요. 멀리서 냄새를 맡고, 원하지 않으면 피해서 지나갈 수 있는 곳에 두세요.",
      sensitivity: "계속 쳐다보기·귀 젖힘·꼬리 세게 흔들기처럼 긴장한 모습이 보이면 가림막을 두거나 다른 방으로 유도해 잠시 마주치지 않게 해 주세요.",
    };
    return { comparison: similarComparison[key][pairLevel], tip: similarTips[key] };
  }

  const highName = firstScore >= secondScore ? firstName : secondName;
  const lowName = firstScore >= secondScore ? secondName : firstName;
  const different: Record<HarmonyDimensionKey, { comparison: string; tip: string }> = {
    social: {
      comparison: `사람과 지낼 때는 ${withJosa(highName, "이/가")} 사람 곁에 다가가거나 따라오는 행동을 더 자주 보이고, ${withJosa(lowName, "은/는")} 혼자 쉬는 시간을 더 길게 둬요. 같은 차이가 두 고양이 사이에서도 나타난다고 단정할 수는 없지만, ${withJosa(lowName, "이/가")} 물러난 뒤 따라가기와 피하기가 반복되면 부담이 될 수 있어요.`,
      tip: `${withJosa(lowName, "이/가")} 피하고 싶을 때 캣타워나 선반으로 올라가거나 다른 방으로 갈 수 있게 길을 열어 두고, 숨숨집도 두 곳 이상 마련하세요. ${withJosa(highName, "이/가")} 뒤따르기 시작하면 낚싯대 놀이나 간식 찾기로 자연스럽게 관심을 돌려 주세요.`,
    },
    energy: {
      comparison: `${withJosa(highName, "이/가")} 놀이를 조금 더 이어가고 싶을 때, ${withJosa(lowName, "은/는")} 먼저 쉬는 자리로 갈 수 있어요. 이때 ${withJosa(highName, "이/가")} 계속 따라가며 놀려고 하면 반복 추격이나 휴식 방해로 이어질 수 있어요.`,
      tip: `${highName}에게 하루 여러 번 혼자 노는 시간을 먼저 마련해 주세요. ${lowName}의 잠자리 가까이에서 추격이 시작되면 장난감을 반대 방향으로 움직여 두 고양이가 서로 멀어지게 해 주세요.`,
    },
    change: {
      comparison: `${withJosa(highName, "이/가")} 달라진 공간을 먼저 둘러보는 동안, ${withJosa(lowName, "은/는")} 익숙한 자리에 머물며 조금 더 오래 살필 수 있어요. ${withJosa(highName, "이/가")} 새 물건이나 밥그릇·화장실 앞에 오래 머물면 ${withJosa(lowName, "이/가")} 다가가기 어려울 수 있어요.`,
      tip: `${lowName}의 밥그릇·화장실·숨는 자리는 그대로 두세요. 새 물건은 평소 쉬거나 먹는 자리와 조금 떨어진 곳에 먼저 놓고, 스스로 다가가 냄새를 맡을 때까지 기다려 주세요. ${highName}와 마주치지 않고도 평소 쓰던 밥그릇과 화장실로 갈 수 있는 길도 남겨 주세요.`,
    },
    sensitivity: {
      comparison: `${withJosa(highName, "이/가")} 같은 소리나 움직임에 먼저 반응해 멈추거나 자리를 옮길 때, ${withJosa(lowName, "은/는")} 반응이 더 작거나 늦을 수 있어요. 반응의 크기가 다를 뿐 어느 한쪽이 더 편안하다는 뜻은 아니에요.`,
      tip: `${highName}에게 사람 발길과 소리가 적고 혼자 숨을 수 있는 자리를 마련하세요. 귀 젖힘·몸 낮추기·꼬리 흔들기처럼 불편한 모습이 보이면 가림막을 두거나 다른 방으로 유도해 잠시 마주치지 않게 해 주세요.`,
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
  if (level(traits.sociability) === "high") cautions.push(`${withJosa(name, "은/는")} 사람에게 다가가거나 따라오는 행동을 자주 보여요. 다른 고양이에게도 같은 방식이라고 단정하지 말고, 실제로 쉬는 자리까지 따라가는지 따로 살펴봐 주세요.`);
  if (level(traits.sociability) === "low") cautions.push(`${name}에게는 혼자 머물 수 있는 자리와, 다른 고양이에게 다가가지 않고도 이동할 수 있는 길을 남겨 두세요. 접촉도 서두르지 마세요.`);
  if (level(traits.activity) === "high" || level(traits.playfulness) === "high") cautions.push(`${name}의 놀이 에너지는 하루 여러 번 짧게 풀어 주세요. 다른 고양이를 쫓기 시작하면 장난감으로 관심을 돌려 주세요.`);
  if (level(traits.activity) === "low" && level(traits.playfulness) === "low") cautions.push(`${withJosa(name, "이/가")} 쉬는 시간에는 갑작스러운 놀이 유도보다 조용히 관찰하고, 짧고 부담 없는 활동부터 제안해 주세요.`);
  if (level(traits.boldness) === "low" || level(traits.adaptability) === "low") cautions.push(`${name}의 식기·화장실·숨는 장소 위치는 한꺼번에 바꾸지 말고, 새 환경은 냄새와 시야부터 천천히 익히게 해 주세요.`);
  if (level(traits.boldness) === "high" && level(traits.adaptability) === "high") cautions.push(`${withJosa(name, "이/가")} 새 공간이나 밥그릇·화장실·높은 자리에 먼저 다가갈 수 있어요. 다른 고양이도 막힘없이 이용하는지 확인해 주세요.`);
  if (level(traits.sensitivity) === "high") cautions.push(`${withJosa(name, "은/는")} 소리와 움직임에 빠르게 반응할 수 있어요. 자주 지내는 방마다 조용히 숨을 자리와 주변을 내려다볼 높은 자리를 마련해 주세요.`);
  if (level(traits.sensitivity) === "low") cautions.push(`${withJosa(name, "은/는")} 평소 소리와 움직임에 반응이 작을 수 있어요. 상대가 응시하거나 귀를 젖히고 꼬리를 세게 흔들 때는 둘이 잠시 떨어져 쉬게 해 주세요.`);

  if (cautions.length < 2) {
    cautions.push(`${withJosa(name, "이/가")} 밥, 물, 화장실, 잠자리에 평소처럼 접근하는지 매일 살펴보고 작은 변화도 기록해 주세요.`);
  }

  const energy = roundedAverage(traits.activity, traits.playfulness);
  const change = roundedAverage(traits.boldness, traits.adaptability);
  const summary = energy >= 67
    ? "충분히 놀아 에너지를 쓴 뒤에는 방해받지 않고 조용히 쉬게 해 주세요."
    : change <= 33 || traits.sensitivity >= 67
      ? "식사와 휴식 시간을 일정하게 유지하고, 다가갈지 물러날지는 스스로 고르게 해 주세요."
      : "평소 생활 시간을 유지하고, 상대가 물러나면 따라가지 않도록 살펴봐 주세요.";
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
  if (socialDifference >= 20) sharedTips.push(`둘 사이에서 ${withJosa(lessSocialName, "이/가")} 자리를 뜨고 ${withJosa(moreSocialName, "이/가")} 뒤따르는 모습이 실제로 보이면, 둘을 잠시 떨어뜨리고 ${moreSocialName}의 관심을 장난감으로 돌려 주세요.`);
  if (energyDifference >= 20) sharedTips.push(`${moreActiveName}에게는 혼자 장난감을 따라 뛰는 시간을 충분히 마련하고, ${lessActiveName}의 잠자리 주변에서는 추격 놀이를 하지 마세요.`);
  if (changeDifference >= 20) sharedTips.push(`가구를 옮기거나 새 물건을 둘 때는 ${withJosa(slowerChangeName, "이/가")} 충분히 살필 시간을 주세요. ${withJosa(fasterChangeName, "이/가")} 앞에 있더라도 ${withJosa(slowerChangeName, "이/가")} 평소 쓰던 밥그릇·화장실·숨는 자리로 갈 수 있도록 길을 막지 말아 주세요.`);
  if (sensitivityDifference >= 20) sharedTips.push(`${moreSensitiveName}에게 사람 발길과 소리가 적고 혼자 숨을 수 있는 자리를 마련해 주세요. 불편한 모습이 보이면 가림막을 두거나 다른 방으로 유도해 잠시 마주치지 않게 해 주세요.`);
  const fallbackSharedTips = [
    "생활 리듬이 비슷해도 밥그릇·물그릇·화장실·잠자리는 서로 떨어진 곳에 따로 마련해 주세요.",
    "한쪽이 자리를 피하거나 몸을 굳히면 교류를 잠시 멈추고, 스스로 다시 나올 때까지 기다려 주세요.",
  ];
  for (const tip of fallbackSharedTips) {
    if (sharedTips.length >= 2) break;
    sharedTips.push(tip);
  }

  return {
    score,
    title,
    dimensions,
    careGuides: [buildCareGuide(firstName, first), buildCareGuide(secondName, second)],
    sharedTips: sharedTips.slice(0, 3),
    commonCautions: [
      "밥그릇과 물그릇은 서로 시야가 겹치지 않는 곳에도 나눠 놓아 주세요.",
      "화장실은 고양이 수보다 하나 더 두는 방식을 고려하고, 서로 마주치지 않아도 갈 수 있도록 떨어진 곳에 놓아 주세요.",
      "계속 쳐다보기, 길 막기, 반복해서 쫓기, 식욕·배변 변화가 이어지면 억지로 가까이 두지 말고 수의사나 고양이 행동 전문가와 상의해 주세요.",
    ],
  };
}
