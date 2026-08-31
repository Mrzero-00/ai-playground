import type { TraitScores } from "@/types/nyangbti";
import { withJosa } from "@/lib/korean";

export interface HarmonyDimension {
  label: string;
  first: number;
  second: number;
  difference: number;
  note: string;
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
  const dimensions: HarmonyDimension[] = [
    { label: "교류 욕구", first: Math.round(first.sociability), second: Math.round(second.sociability), difference: Math.abs(first.sociability - second.sociability), note: "다가가는 속도가 다르면 먼저 거리를 선택할 수 있게 해주세요." },
    { label: "활동 · 놀이", first: roundedAverage(first.activity, first.playfulness), second: roundedAverage(second.activity, second.playfulness), difference: Math.abs(roundedAverage(first.activity, first.playfulness) - roundedAverage(second.activity, second.playfulness)), note: "놀이 에너지 차이는 각자 따로 노는 시간으로 맞춰주세요." },
    { label: "변화 적응", first: roundedAverage(first.boldness, first.adaptability), second: roundedAverage(second.boldness, second.adaptability), difference: Math.abs(roundedAverage(first.boldness, first.adaptability) - roundedAverage(second.boldness, second.adaptability)), note: "환경 변화는 더 신중한 고양이의 속도에 맞춰주세요." },
    { label: "민감도", first: Math.round(first.sensitivity), second: Math.round(second.sensitivity), difference: Math.abs(first.sensitivity - second.sensitivity), note: "숨을 곳과 높은 자리를 여러 군데 마련하면 긴장 완화에 도움이 돼요." },
  ];
  const averageDifference = roundedAverage(...dimensions.map((item) => item.difference));
  const score = Math.max(40, Math.round(100 - averageDifference * 0.72));
  const title = averageDifference < 16 ? "비슷한 리듬을 가진 동료" : averageDifference < 31 ? "다름을 알아가면 좋은 조합" : "각자의 속도를 존중할 조합";
  const sharedTips: string[] = [];
  const socialDifference = Math.abs(first.sociability - second.sociability);
  const energyDifference = Math.abs(roundedAverage(first.activity, first.playfulness) - roundedAverage(second.activity, second.playfulness));
  const changeDifference = Math.abs(roundedAverage(first.boldness, first.adaptability) - roundedAverage(second.boldness, second.adaptability));
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
