import { TRAIT_KEYS } from "@/types/nyangbti";
import type { AxisResult, NyangBtiResult, TraitKey, TraitScores, TypeContent } from "@/types/nyangbti";
import { getTraitLevel } from "@/lib/scoring";
import { withJosa } from "@/lib/korean";

type TraitLevel = ReturnType<typeof getTraitLevel>;

export interface BehaviorResultCopy {
  description: string;
  strengths: string[];
  cautions: string[];
  observationSigns: string[];
  care: TypeContent["care"];
}

const RELATIONSHIP_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "사람과 지낼 때는 먼저 거리를 정하고 혼자 쉬는 시간이 충분할 때 편안해요.",
  중간: "사람과 지낼 때는 컨디션에 따라 곁에 머무는 시간과 혼자 쉬는 시간을 조절해요.",
  높음: "사람과 지낼 때는 가까이 머물며 눈맞춤·따라오기·몸 비비기로 마음을 자주 표현해요.",
};

const SENSITIVITY_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "평소 듣던 소리와 주변 움직임에는 비교적 차분하게 반응하는 편이에요.",
  중간: "익숙한 소리와 움직임은 편안하게 받아들이지만, 갑작스럽거나 반복되면 자리를 옮길 수 있어요.",
  높음: "작은 소리나 접촉, 주변의 움직임도 빠르게 알아차려 멈추거나 자리를 옮길 수 있어요.",
};

const EXPLORATION_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "낯선 사람이나 물건 앞에서는 서두르지 않고 안전한지 충분히 살핀 뒤 움직여요.",
  중간: "낯선 사람이나 물건을 바로 피하거나 향하기보다 먼저 살펴본 뒤 반응을 정해요.",
  높음: "처음 보는 사람이나 물건, 낯선 공간에도 비교적 빠르게 다가가 살펴봐요.",
};

const CHANGE_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "환경이나 일과가 달라지면 익숙한 냄새와 자주 다니던 길을 확인하며 천천히 적응해요.",
  중간: "생활이 달라지면 먼저 살펴보고, 안전하다고 느끼는 만큼 자기 속도로 받아들여요.",
  높음: "환경이나 일과가 달라져도 평소 먹고 쉬는 생활을 비교적 빨리 되찾아요.",
};

const ACTIVITY_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "놀이와 휴식에서는 오래 쉬고 짧게 움직이는 생활이 편해요.",
  중간: "놀이와 휴식에서는 움직이는 시간과 쉬는 시간이 비교적 고르게 나타나요.",
  높음: "놀이와 휴식에서는 달리기·오르기처럼 몸을 쓰는 활동을 자주 필요로 해요.",
};

const PLAY_NARRATIVE: Record<TraitLevel, string> = {
  낮음: "장난감은 익숙하고 천천히 움직이는 것을 자기 속도로 선택하는 편이에요.",
  중간: "흥미가 맞는 장난감에는 집중하고, 충분히 놀면 스스로 쉬는 편이에요.",
  높음: "사냥 놀이와 새로운 장난감에서 즐거움을 찾고 놀이를 자주 이어가려 해요.",
};

export interface TypePresentation {
  name: string;
  tagline: string;
  isBalanced: boolean;
}

const TRAIT_INTERPRETATIONS: Record<TraitKey, Record<TraitLevel, string>> = {
  sociability: {
    낮음: "사람과의 거리를 스스로 정하고 혼자 쉬는 시간이 충분할 때 편안해요.",
    중간: "상황과 컨디션에 따라 사람 곁에 머무는 시간과 혼자 쉬는 시간을 조절해요.",
    높음: "사람 가까이 머물며 눈맞춤·따라오기·몸 비비기 같은 교류를 자주 찾는 편이에요.",
  },
  boldness: {
    낮음: "낯선 사람·물건·소리를 충분히 살핀 뒤 안전하다고 느껴질 때 움직여요.",
    중간: "낯선 상황을 바로 피하거나 다가가기보다 먼저 확인한 뒤 반응을 정해요.",
    높음: "처음 보는 대상이나 공간에도 비교적 빠르게 다가가 확인하는 편이에요.",
  },
  activity: {
    낮음: "긴 휴식과 짧은 움직임이 편한 리듬이에요. 활동을 재촉하기보다 스스로 움직일 때를 기다려 주세요.",
    중간: "움직이는 시간과 쉬는 시간이 비교적 고르게 나타나는 생활 리듬이에요.",
    높음: "달리기·오르기·이동처럼 몸을 쓰는 활동을 자주 필요로 하는 편이에요.",
  },
  playfulness: {
    낮음: "장난감에 바로 반응하기보다 익숙하고 부담이 적은 놀이를 자기 속도로 선택해요.",
    중간: "흥미가 맞는 장난감에는 참여하고 충분히 놀면 스스로 쉬는 편이에요.",
    높음: "사냥 놀이와 새로운 장난감에서 즐거움을 찾고 놀이를 자주 이어가려 해요.",
  },
  adaptability: {
    낮음: "환경이나 일과가 달라지면 익숙한 냄새와 자주 다니던 길을 확인하며 적응할 시간이 필요해요.",
    중간: "변화를 먼저 살펴본 뒤 안전하다고 느끼는 만큼 자기 속도로 받아들여요.",
    높음: "환경이나 일과가 달라져도 평소 먹고 쉬는 리듬을 비교적 빨리 되찾아요.",
  },
  sensitivity: {
    낮음: "익숙한 소리·움직임·접촉에 반응이 비교적 작고 평소 리듬을 이어가는 편이에요.",
    중간: "익숙한 소리와 움직임에는 편안하지만, 갑작스럽거나 반복되면 멈추거나 자리를 옮길 수 있어요.",
    높음: "작은 소리·접촉·주변 변화도 빠르게 알아차리고 멈추거나 자리를 옮길 수 있어요.",
  },
};

const SUMMARY_SENTENCES: Record<TraitKey, Record<"low" | "high", (name: string) => string>> = {
  sociability: {
    low: (name) => `${withJosa(name, "은/는")} 사람과의 거리를 스스로 정하고 혼자 편안히 쉬는 시간이 중요한 편이에요.`,
    high: (name) => `${withJosa(name, "은/는")} 사람 가까이 머물며 다가오기·따라오기 같은 표현을 자주 보여요.`,
  },
  boldness: {
    low: (name) => `${withJosa(name, "은/는")} 낯선 상황에서 서두르지 않고 안전을 충분히 확인한 뒤 움직여요.`,
    high: (name) => `${withJosa(name, "은/는")} 처음 보는 대상이나 공간에도 비교적 빠르게 다가가 살펴봐요.`,
  },
  activity: {
    low: (name) => `${withJosa(name, "은/는")} 긴 휴식과 짧은 움직임이 편한 생활 리듬을 가지고 있어요.`,
    high: (name) => `${withJosa(name, "은/는")} 달리기와 오르기처럼 몸을 쓰는 활동을 자주 필요로 해요.`,
  },
  playfulness: {
    low: (name) => `${withJosa(name, "은/는")} 놀이를 서두르기보다 익숙하고 천천히 움직이는 장난감을 자기 속도로 선택해요.`,
    high: (name) => `${withJosa(name, "은/는")} 사냥 놀이와 다양한 장난감에서 즐거움을 자주 찾아요.`,
  },
  adaptability: {
    low: (name) => `${withJosa(name, "은/는")} 생활 변화가 생기면 익숙한 냄새와 자주 다니던 길을 확인하며 적응할 시간이 필요해요.`,
    high: (name) => `${withJosa(name, "은/는")} 환경이나 일과가 달라져도 평소 리듬을 비교적 빠르게 되찾아요.`,
  },
  sensitivity: {
    low: (name) => `${withJosa(name, "은/는")} 익숙한 소리와 주변 움직임에 비교적 차분하게 반응해요.`,
    high: (name) => `${withJosa(name, "은/는")} 작은 소리와 접촉, 주변 변화도 빠르게 알아차리는 편이에요.`,
  },
};

const STRENGTHS: Record<TraitKey, Record<TraitLevel, string>> = {
  sociability: {
    낮음: "혼자 쉬며 스스로 안정되는 시간을 편안하게 활용해요. 조용한 자리를 골라 충분히 쉰 뒤, 원할 때 다시 같은 공간으로 돌아오는 모습에서 이 성향이 잘 보여요.",
    중간: "편안할 때는 사람 곁에 머물고 피곤할 때는 조용한 자리로 이동해요. 그날 상태에 맞춰 함께하는 시간과 혼자 쉬는 시간을 스스로 조절하는 편이에요.",
    높음: "다가오기·따라오기·몸 비비기처럼 함께 있고 싶다는 표현이 분명해요. 집사가 반응하면 곁에 머물거나 같은 행동을 반복해 관심을 주고받으려 해요.",
  },
  boldness: {
    낮음: "낯선 상황에서 서두르지 않고 안전을 먼저 살펴요. 멀리서 냄새와 소리를 확인하고, 도망갈 곳이 있는지 살핀 뒤 움직이는 신중함이 강점이에요.",
    중간: "처음 보는 사람이나 물건을 바로 피하거나 향하지 않고 잠시 지켜봐요. 안전하다고 판단하면 자기 속도로 거리를 좁혀 가요.",
    높음: "새 물건과 낯선 공간을 비교적 빠르게 확인해요. 먼저 냄새를 맡고 오르거나 안쪽을 살피며 새로운 환경을 익히는 데 적극적인 편이에요.",
  },
  activity: {
    낮음: "오래 쉬고 짧게 움직이는 방식으로 자기 리듬을 안정적으로 유지해요. 편안한 자리에서 충분히 쉰 뒤 필요한 순간에 움직이는 모습이 뚜렷해요.",
    중간: "움직이는 시간과 쉬는 시간을 자연스럽게 번갈아 가져요. 짧게 활동한 뒤 스스로 휴식을 선택해 무리하지 않는 편이에요.",
    높음: "달리기·오르기·쫓기처럼 몸을 쓰는 활동으로 에너지를 적극적으로 풀어요. 집 안을 여러 번 이동하거나 높은 자리를 오르며 움직일 기회를 스스로 찾아요.",
  },
  playfulness: {
    낮음: "익숙하고 천천히 움직이는 장난감을 자기 속도로 선택해요. 바로 반응하지 않더라도 멀리서 지켜보다가 편안할 때 짧게 참여할 수 있어요.",
    중간: "흥미가 맞는 장난감에는 집중하고 충분히 놀면 스스로 쉬어요. 놀이의 시작과 끝을 비교적 분명하게 보여주는 편이에요.",
    높음: "사냥 놀이와 다양한 장난감에서 즐거움을 잘 찾아요. 장난감을 치운 뒤에도 따라오거나 다시 시도하며 놀이를 이어가고 싶다는 표현을 보여요.",
  },
  adaptability: {
    낮음: "익숙한 밥그릇·잠자리와 자주 다니는 길에서 안정감을 찾아요. 주변이 달라져도 익숙한 냄새와 물건을 확인하며 천천히 평소 생활로 돌아오는 편이에요.",
    중간: "달라진 물건이나 일정을 먼저 살핀 뒤 자기 속도로 받아들여요. 충분히 확인할 시간이 있으면 식사와 휴식 같은 평소 생활을 차분하게 이어가요.",
    높음: "가구 위치나 생활 일정이 달라져도 평소 리듬을 비교적 빨리 되찾아요. 새 물건을 살핀 뒤 식사·놀이·휴식으로 자연스럽게 돌아오는 편이에요.",
  },
  sensitivity: {
    낮음: "평소 듣던 소리와 주변 움직임 속에서 차분한 리듬을 이어가요. 작은 변화에는 잠깐 바라보는 정도로 반응하고 하던 행동을 계속할 수 있어요.",
    중간: "소리나 움직임이 익숙한지, 얼마나 큰지에 따라 반응을 달리해요. 평소 자극은 넘기지만 갑작스러운 변화에는 멈춰서 상황을 확인해요.",
    높음: "작은 소리·접촉·환경 변화를 빠르게 알아차려요. 귀를 움직이거나 몸을 낮추고 자리를 옮기는 등 주변 변화에 대한 반응이 비교적 분명해요.",
  },
};

function rankedTraits(traits: TraitScores) {
  return TRAIT_KEYS.map((trait, index) => ({
    trait,
    score: traits[trait],
    distance: Math.abs(traits[trait] - 50),
    index,
  })).sort((a, b) => b.distance - a.distance || a.index - b.index);
}

function buildDescription(traits: TraitScores, catName: string): string {
  const distinctive = rankedTraits(traits).filter(({ distance }) => distance >= 12).slice(0, 2);
  if (distinctive.length === 0) {
    return `${withJosa(catName, "은/는")} 어느 한 모습으로 강하게 기울기보다 상황에 따라 사람 곁과 혼자만의 시간, 익숙함과 새로움을 고르게 오가는 편이에요.`;
  }
  const subject = `${withJosa(catName, "은/는")} `;
  const sentences = distinctive.map(({ trait, score }, index) => {
    const sentence = SUMMARY_SENTENCES[trait][score >= 50 ? "high" : "low"](catName);
    return index === 0 ? sentence : sentence.replace(subject, "또 ");
  });
  return `${sentences.join(" ")} 고양이 MBTI는 이 행동 성향을 친숙하게 요약한 결과예요.`;
}

function buildNeeds(traits: TraitScores) {
  const energy = Math.round((traits.activity + traits.playfulness) / 2);
  const candidates: { weight: number; caution: string; observation: string }[] = [];

  if (traits.sensitivity >= 65) candidates.push({
    weight: traits.sensitivity - 50,
    caution: "큰 소리, 갑작스러운 접촉, 사람의 빠른 움직임이 한꺼번에 이어지면 놀란 뒤에도 쉽게 진정하지 못할 수 있어요. 청소기 사용·손님 방문·가구 이동처럼 큰 변화는 가능하면 같은 시간에 겹치지 않게 해 주세요.",
    observation: "특정 소리나 접촉 뒤 숨는 시간, 그루밍 횟수, 집 안을 움직이는 범위가 평소와 달라지는지 살펴보세요. 자극이 끝난 뒤에도 오래 숨거나 식사까지 거르면 변화가 얼마나 이어지는지 기록해 주세요.",
  });
  if (traits.adaptability < 40) candidates.push({
    weight: 50 - traits.adaptability,
    caution: "가구 위치·화장실 모래·식사 시간을 한꺼번에 바꾸면 무엇이 안전한지 다시 확인하느라 부담이 커질 수 있어요. 꼭 필요한 변화도 한 번에 하나씩 진행해 주세요.",
    observation: "환경이 달라진 뒤 식사량, 화장실 이용, 잠자리와 숨는 시간이 평소와 달라지는지 살펴보세요. 새 환경을 살피는 시간이 지나도 원래 생활로 돌아오지 못하는지 함께 기록해 주세요.",
  });
  if (traits.boldness < 40) candidates.push({
    weight: 50 - traits.boldness,
    caution: "낯선 사람이나 물건 가까이로 바로 데려가면 도망갈 곳이 없다고 느낄 수 있어요. 멀리서 냄새와 움직임을 살피고 스스로 다가갈 때까지 기다려 주세요.",
    observation: "낯선 일이 끝난 뒤에도 계속 숨거나 몸을 낮추는지, 평소 다니던 방으로 나오지 않는지 살펴보세요. 경계가 풀리는 데 걸린 시간도 평소와 비교해 보세요.",
  });
  if (traits.boldness >= 65) candidates.push({
    weight: traits.boldness - 50,
    caution: "새 공간을 빠르게 살피다가 열린 문, 불안정한 높은 곳, 삼킬 수 있는 작은 물건을 먼저 만날 수 있어요. 새로운 공간을 열기 전에 출입문과 위험한 틈부터 확인해 주세요.",
    observation: "문밖으로 나가려 하거나 위험한 틈과 불안정한 높은 곳을 반복해서 살피는지 확인하세요. 호기심이 커지는 시간과 장소를 알아두면 미리 안전한 탐색 거리로 바꾸기 쉬워요.",
  });
  if (energy >= 65) candidates.push({
    weight: energy - 50,
    caution: "흥분이 가라앉지 않은 채 추격이나 격한 놀이가 길어지면 놀이가 끝난 뒤에도 물기·달리기·서성임이 이어질 수 있어요. 잡는 성공을 준 뒤 간식이나 식사로 차분하게 마무리해 주세요.",
    observation: "놀이 뒤 헐떡임, 동공 확대, 꼬리를 세게 흔드는 모습이나 수면 방해가 나타나는지 살펴보세요. 평소보다 진정하는 데 오래 걸리면 다음 놀이는 더 짧고 느리게 진행해 주세요.",
  });
  if (energy < 40) candidates.push({
    weight: 50 - energy,
    caution: "고개를 돌리거나 자리를 뜨는데도 빠르거나 긴 놀이를 계속 권하면 놀이 자체를 피할 수 있어요. 짧게 제안한 뒤 반응이 없으면 그 자리에서 끝내 주세요.",
    observation: "평소와 비교해 움직이는 시간, 장난감을 바라보는 반응, 높은 곳에 오르는 횟수가 갑자기 줄었는지 살펴보세요. 좋아하던 놀이까지 계속 피하면 식욕·배변·걸음걸이 변화도 함께 확인해 주세요.",
  });
  if (traits.sociability < 40) candidates.push({
    weight: 50 - traits.sociability,
    caution: "혼자 쉬려고 자리를 옮겼는데 따라가거나 다시 만지면 편히 쉴 곳이 없다고 느낄 수 있어요. 고개를 돌리거나 자리를 뜨면 따라가지 말고 먼저 돌아올 때까지 기다려 주세요.",
    observation: "사람이 다가온 뒤 숨거나 다른 길로 돌아가고, 몸을 굳히는 일이 반복되는지 살펴보세요. 누구에게, 어느 장소에서 이런 반응이 자주 나타나는지도 함께 확인해 주세요.",
  });
  if (traits.sociability >= 65) candidates.push({
    weight: traits.sociability - 50,
    caution: "다가오거나 따라오며 관심을 표현하는데 계속 반응하지 않으면 울거나 서성이는 행동이 늘 수 있어요. 짧게라도 눈을 맞추거나 말을 건 뒤, 교감이 끝나면 혼자 쉴 자리도 남겨 주세요.",
    observation: "혼자 있을 때 우는 시간, 문 앞을 서성이는 횟수, 사람을 따라다니는 행동이 평소보다 늘어나는지 살펴보세요. 관심을 받은 뒤 차분해지는지도 함께 확인해 주세요.",
  });

  candidates.sort((a, b) => b.weight - a.weight);
  const selected = candidates.slice(0, 2);
  const cautions = selected.map(({ caution }) => caution);
  const observationSigns = selected.map(({ observation }) => observation);
  const fallbackCautions = [
    "고양이가 자리를 피하거나 몸을 굳혔는데도 계속 만지거나 놀아 주면 접촉 자체를 피하게 될 수 있어요. 귀·꼬리·몸의 힘이 풀릴 때까지 기다려 주세요.",
    "밥그릇·잠자리·화장실로 가는 익숙한 길을 막거나 자주 바꾸면 일상에서 안전하다고 느끼는 범위가 줄어들 수 있어요. 자주 쓰는 길과 물건 위치는 한꺼번에 바꾸지 마세요.",
  ];
  const fallbackObservations = [
    "식사량, 화장실 이용, 잠자는 시간과 숨는 시간이 평소와 다르게 이어지는지 살펴보세요. 하루의 작은 변화보다 며칠 동안 같은 변화가 반복되는지를 확인하는 것이 중요해요.",
    "평소 좋아하던 사람·장소·놀이를 갑자기 피하기 시작하는지 살펴보세요. 언제부터 무엇을 피했는지 적어 두면 생활 변화와 연결해 보기 쉬워요.",
  ];
  for (const caution of fallbackCautions) {
    if (cautions.length >= 2) break;
    cautions.push(caution);
  }
  for (const observation of fallbackObservations) {
    if (observationSigns.length >= 2) break;
    observationSigns.push(observation);
  }
  return { cautions: cautions.slice(0, 2), observationSigns: observationSigns.slice(0, 2) };
}

function buildCare(traits: TraitScores): TypeContent["care"] {
  const energy = Math.round((traits.activity + traits.playfulness) / 2);
  const play = energy >= 65
    ? "깨어 있고 주변을 살피는 시간에 짧은 사냥 놀이를 하루 여러 번 해 주세요. 장난감을 숨겼다가 달아나는 먹잇감처럼 움직이고, 마지막에는 잡게 한 뒤 간식이나 식사로 마무리해 흥분을 가라앉혀요."
    : energy < 40
      ? "바닥 가까이에서 익숙한 장난감을 천천히 움직여 짧게 제안해 보세요. 바라보기·앞발 뻗기처럼 작은 반응도 놀이 참여로 보고, 반응이 없거나 자리를 뜨면 장난감을 치우고 쉬게 해요."
      : "깨어 있을 때 짧게 집중하는 사냥 놀이를 제안하고, 잡는 성공을 한두 번 경험한 뒤 충분히 쉬게 해요. 같은 장난감도 빠르기와 숨는 위치를 조금씩 바꾸면 부담 없이 흥미를 이어갈 수 있어요.";

  const environment = traits.sensitivity >= 65
    ? "사람 발길과 소리가 적은 숨는 자리와 주변을 내려다볼 높은 자리를 각각 마련해 주세요. 밥그릇·화장실·잠자리로 갈 때 시끄러운 공간을 지나지 않아도 되게 하고, 숨은 고양이를 억지로 꺼내지 마세요."
    : traits.boldness < 40 || traits.adaptability < 40
      ? "익숙한 숨는 자리와 자주 다니는 길은 그대로 두세요. 새 물건은 평소 쉬거나 먹는 자리에서 조금 떨어진 곳에 놓고, 먼저 다가가 냄새를 맡고 돌아갈 수 있게 해요. 새 물건이 있어도 평소처럼 밥을 먹고 화장실을 이용하는지 확인한 뒤 자리를 옮겨 주세요."
    : traits.boldness >= 65
      ? "튼튼한 캣타워, 터널, 상자처럼 오르고 숨고 살필 곳을 여러 높이에 마련해 주세요. 새로운 공간을 열기 전에는 문·창문과 삼킬 수 있는 작은 물건을 먼저 확인해 안전한 호기심으로 이어지게 해요."
      : "숨는 자리, 주변을 내려다볼 높은 자리, 몸을 움직일 공간을 나누어 마련해 주세요. 쉬고 싶은 날과 움직이고 싶은 날에 스스로 장소를 고를 수 있도록 자주 쓰는 길은 막지 마세요.";

  const routine = traits.adaptability < 40 || traits.sensitivity >= 65
    ? "평소 식사·놀이·휴식 시간은 유지하세요. 새 물건이나 일정은 한 번에 하나씩 바꾸고, 평소 생활로 돌아올 때까지 다음 변화는 미뤄 주세요. 바꾼 뒤 식사량·화장실 이용·숨는 시간이 달라지면 이전 상태로 잠시 돌아가요."
    : traits.adaptability >= 65
      ? "기본 식사와 휴식 시간은 지키면서 장난감, 상자, 놀이 위치를 하나씩 바꿔 주세요. 새로움을 잘 받아들이더라도 식사·배변·수면이 평소와 달라지면 변화의 수를 잠시 줄여요."
      : "평소 식사와 휴식 시간은 유지하고, 바꿀 일이 생기면 한 번에 한 가지만 조정해 주세요. 일정이 달라지는 날에는 평소 쓰던 말이나 그릇을 준비하는 행동을 먼저 보여 주면 다음 일을 예상하기 쉬워요.";

  const relationship = traits.sociability >= 65
    ? "먼저 다가오거나 따라올 때 눈을 맞추고 짧게 쓰다듬거나 말을 걸어 자주 반응해 주세요. 다만 고개를 돌리거나 꼬리를 세게 흔들고 자리를 뜨면 더 만지지 말고, 혼자 쉴 시간을 남겨 주세요."
    : traits.sociability < 40
      ? "바로 만지기보다 같은 공간에서 조용히 각자 시간을 보내는 것부터 시작해 주세요. 고양이가 먼저 다가와 냄새를 맡거나 몸을 기대면 짧게 쓰다듬고, 다시 물러나면 따라가지 말고 기다려요."
      : "다가오면 짧게 쓰다듬거나 함께 놀고, 고개를 돌리거나 물러나면 따라가지 말고 기다려 주세요. 같은 날에도 교감을 원하는 정도가 달라질 수 있으니 한 번의 반응보다 그날의 반복된 모습을 기준으로 맞춰 주세요.";

  return { play, environment, routine, relationship };
}

export function getTraitInterpretation(trait: TraitKey, score: number): string {
  return TRAIT_INTERPRETATIONS[trait][getTraitLevel(score)];
}

export function buildBehaviorResultCopy(traits: TraitScores, catName = "고양이"): BehaviorResultCopy {
  const strengths = rankedTraits(traits)
    .slice(0, 2)
    .map(({ trait, score }) => STRENGTHS[trait][getTraitLevel(score)]);
  const needs = buildNeeds(traits);
  return {
    description: buildDescription(traits, catName),
    strengths,
    cautions: needs.cautions,
    observationSigns: needs.observationSigns,
    care: buildCare(traits),
  };
}

export function getTypePresentation(result: NyangBtiResult, content: TypeContent): TypePresentation {
  const weakAxisCount = Object.values(result.axes).filter(({ level }) => level === "낮음").length;
  if (weakAxisCount >= 3) {
    return {
      name: `균형형 · ${result.code}에 가장 가까워요`,
      tagline: "한 가지 모습보다 상황에 따른 차이를 함께 봐 주세요",
      isBalanced: true,
    };
  }
  return { name: content.name, tagline: content.tagline, isBalanced: false };
}

const BALANCED_AXIS_COPY: Record<AxisResult["key"], string> = {
  EI: "사람 곁과 혼자만의 거리 중 한쪽으로 크게 기울지 않고 상황에 따라 조절해요.",
  NS: "익숙한 것과 새 물건 사이에서 주변을 살핀 뒤 움직이는 편이에요.",
  TF: "사람과 주변 변화에 반응하는 정도가 한쪽으로 크게 기울지 않아요.",
  JP: "활발히 놀고 움직이는 시간과 익숙한 생활 시간을 모두 중요하게 여겨요.",
};

const AXIS_COPY: Record<AxisResult["key"], Record<string, string>> = {
  EI: { E: "사람 곁에 머물며 관심을 주고받는 쪽에 가까워요.", I: "혼자 쉴 거리를 확보할 때 편안한 쪽에 가까워요." },
  NS: { N: "새 물건이나 낯선 공간을 비교적 먼저 살펴보는 쪽에 가까워요.", S: "익숙한 환경을 충분히 확인한 뒤 움직이는 쪽에 가까워요." },
  TF: { F: "사람의 움직임이나 작은 주변 변화를 빨리 알아차리는 쪽에 가까워요.", T: "익숙한 소리와 주변 변화에 반응이 비교적 작은 쪽에 가까워요." },
  JP: { P: "놀이와 움직임, 순간의 흥미를 따라가는 쪽에 가까워요.", J: "긴 활동보다 익숙하고 예측 가능한 리듬을 선호하는 쪽에 가까워요." },
};

function getAxisBehaviorDetail(axis: AxisResult, traits: TraitScores): string {
  switch (axis.key) {
    case "EI":
      return `${RELATIONSHIP_NARRATIVE[getTraitLevel(traits.sociability)]} ${SENSITIVITY_NARRATIVE[getTraitLevel(traits.sensitivity)]}`;
    case "NS":
      return `${EXPLORATION_NARRATIVE[getTraitLevel(traits.boldness)]} ${CHANGE_NARRATIVE[getTraitLevel(traits.adaptability)]}`;
    case "TF":
      return `${SENSITIVITY_NARRATIVE[getTraitLevel(traits.sensitivity)]} ${RELATIONSHIP_NARRATIVE[getTraitLevel(traits.sociability)]}`;
    case "JP":
      return `${ACTIVITY_NARRATIVE[getTraitLevel(traits.activity)]} ${PLAY_NARRATIVE[getTraitLevel(traits.playfulness)]} ${CHANGE_NARRATIVE[getTraitLevel(traits.adaptability)]}`;
  }
}

export function getAxisPresentation(axis: AxisResult, traits: TraitScores) {
  const heading = axis.level === "낮음" ? `${axis.first}·${axis.second} 균형` : `${axis.selected} 성향`;
  const summary = axis.level === "낮음" ? BALANCED_AXIS_COPY[axis.key] : AXIS_COPY[axis.key][axis.selected];
  return { heading, description: `${summary} ${getAxisBehaviorDetail(axis, traits)}` };
}
