import type { Question } from "@/types/nyangbti";

export const ANSWER_OPTIONS = [
  { value: 0, label: "거의 그렇지 않아요", shortLabel: "거의 안 그래요" },
  { value: 1, label: "드물게 그래요", shortLabel: "드물게" },
  { value: 2, label: "가끔 그래요", shortLabel: "가끔" },
  { value: 3, label: "자주 그래요", shortLabel: "자주" },
  { value: 4, label: "거의 항상 그래요", shortLabel: "거의 항상" },
] as const;

/**
 * 냥BTI 문항 데이터셋 v0.1
 *
 * 응답은 0~4, 중앙값 2로 저장한다. weights의 부호는 문항 방향을 뜻하며
 * 스코어러가 각 trait의 이론적 최소/최대치를 계산해 0~100으로 정규화한다.
 */
export const QUESTIONS: Question[] = [
  {
    id: "SOC01",
    trait: "sociability",
    prompt: "가족이 방에 들어오면 먼저 다가가 인사하나요?",
    context: "꼬리 세우기, 몸 비비기, 가까이 앉기 등을 떠올려 주세요.",
    weights: { sociability: 1, boldness: 0.15 },
  },
  {
    id: "SOC02",
    trait: "sociability",
    prompt: "집 안에서 집사를 따라다니며 같은 공간에 머무르려 하나요?",
    weights: { sociability: 1, sensitivity: 0.1 },
  },
  {
    id: "SOC03",
    trait: "sociability",
    prompt: "익숙한 사람이 쓰다듬거나 안아줄 때 편안하게 받아들이나요?",
    weights: { sociability: 0.9, sensitivity: -0.2 },
  },
  {
    id: "SOC04",
    trait: "sociability",
    prompt: "혼자 쉴 수 있는 상황에서도 사람 가까운 자리를 고르나요?",
    weights: { sociability: 0.85, adaptability: 0.1 },
  },
  {
    id: "SOC05",
    trait: "sociability",
    prompt: "관심을 받아도 자리를 피하고 혼자 있는 편인가요?",
    context: "쉬고 있을 때 잠깐 피하는 행동보다 평소 경향을 기준으로 답해 주세요.",
    weights: { sociability: -1, sensitivity: 0.15 },
  },
  {
    id: "BOL01",
    trait: "boldness",
    prompt: "처음 보는 사람이 와도 숨어 있기보다 멀리서라도 살펴보나요?",
    weights: { boldness: 1, sociability: 0.15 },
  },
  {
    id: "BOL02",
    trait: "boldness",
    prompt: "낯선 물건이나 상자를 보면 비교적 빨리 다가가 확인하나요?",
    weights: { boldness: 0.9, playfulness: 0.2 },
  },
  {
    id: "BOL03",
    trait: "boldness",
    prompt: "평소 듣지 못한 작은 소리가 나도 곧 일상 행동으로 돌아오나요?",
    weights: { boldness: 0.9, sensitivity: -0.25, adaptability: 0.15 },
  },
  {
    id: "BOL04",
    trait: "boldness",
    prompt: "높은 곳이나 새로운 동선을 자신 있게 탐색하나요?",
    weights: { boldness: 0.8, activity: 0.2 },
  },
  {
    id: "BOL05",
    trait: "boldness",
    prompt: "익숙하지 않은 상황에서는 오래 숨고 나오기 어려워하나요?",
    weights: { boldness: -1, sensitivity: 0.25, adaptability: -0.15 },
  },
  {
    id: "ACT01",
    trait: "activity",
    prompt: "하루 중 집 안을 빠르게 달리거나 뛰는 시간이 자주 있나요?",
    weights: { activity: 1, playfulness: 0.15 },
  },
  {
    id: "ACT02",
    trait: "activity",
    prompt: "캣타워나 선반처럼 수직 공간을 자주 오르내리나요?",
    weights: { activity: 0.95, boldness: 0.1 },
  },
  {
    id: "ACT03",
    trait: "activity",
    prompt: "깨어 있는 동안 여기저기 이동하며 할 일을 찾는 편인가요?",
    weights: { activity: 0.9, playfulness: 0.15 },
  },
  {
    id: "ACT04",
    trait: "activity",
    prompt: "짧은 놀이가 끝난 뒤에도 더 움직이거나 놀고 싶어 하나요?",
    weights: { activity: 0.85, playfulness: 0.25 },
  },
  {
    id: "ACT05",
    trait: "activity",
    prompt: "주변에서 활동이 있어도 한 자리에서 오래 쉬는 편인가요?",
    weights: { activity: -1, adaptability: 0.1 },
  },
  {
    id: "PLY01",
    trait: "playfulness",
    prompt: "낚싯대나 움직이는 장난감에 금방 몰입하나요?",
    weights: { playfulness: 1, activity: 0.15 },
  },
  {
    id: "PLY02",
    trait: "playfulness",
    prompt: "혼자서도 공, 인형, 종이 등을 놀이로 만들어 즐기나요?",
    weights: { playfulness: 0.9, adaptability: 0.15 },
  },
  {
    id: "PLY03",
    trait: "playfulness",
    prompt: "새 장난감이나 새로운 놀이 방식에 호기심을 보이나요?",
    weights: { playfulness: 0.9, boldness: 0.15, adaptability: 0.15 },
  },
  {
    id: "PLY04",
    trait: "playfulness",
    prompt: "숨어 있다 튀어나오기처럼 사냥 놀이 동작을 자주 하나요?",
    weights: { playfulness: 0.85, activity: 0.2 },
  },
  {
    id: "PLY05",
    trait: "playfulness",
    prompt: "여러 방식으로 권해도 놀이에 거의 반응하지 않는 편인가요?",
    context: "최근 갑자기 반응이 줄었다면 결과와 별개로 건강 상태를 살펴봐 주세요.",
    weights: { playfulness: -1, activity: -0.1 },
  },
  {
    id: "ADP01",
    trait: "adaptability",
    prompt: "가구나 생활 동선이 조금 바뀌어도 평소 리듬을 빨리 되찾나요?",
    weights: { adaptability: 1, boldness: 0.15, sensitivity: -0.15 },
  },
  {
    id: "ADP02",
    trait: "adaptability",
    prompt: "식사나 놀이 시간이 달라져도 큰 스트레스 없이 기다리나요?",
    weights: { adaptability: 0.9, sensitivity: -0.15 },
  },
  {
    id: "ADP03",
    trait: "adaptability",
    prompt: "새 화장실, 방석, 이동장 같은 생활용품을 비교적 잘 받아들이나요?",
    weights: { adaptability: 0.95, boldness: 0.1 },
  },
  {
    id: "ADP04",
    trait: "adaptability",
    prompt: "낯선 환경에서도 안전한 곳을 찾은 뒤 차츰 탐색을 시작하나요?",
    weights: { adaptability: 0.85, boldness: 0.2 },
  },
  {
    id: "ADP05",
    trait: "adaptability",
    prompt: "정해진 일과가 조금만 달라져도 오래 불편해하나요?",
    weights: { adaptability: -1, sensitivity: 0.2 },
  },
  {
    id: "SEN01",
    trait: "sensitivity",
    prompt: "작은 소리나 움직임에도 귀와 시선을 빠르게 돌리나요?",
    weights: { sensitivity: 1, boldness: -0.1 },
  },
  {
    id: "SEN02",
    trait: "sensitivity",
    prompt: "냄새, 모래, 그릇, 담요의 미세한 변화도 금방 알아차리나요?",
    weights: { sensitivity: 0.95, adaptability: -0.15 },
  },
  {
    id: "SEN03",
    trait: "sensitivity",
    prompt: "사람의 목소리나 집 안 분위기가 달라지면 행동도 달라지나요?",
    weights: { sensitivity: 0.9, sociability: 0.1 },
  },
  {
    id: "SEN04",
    trait: "sensitivity",
    prompt: "쓰다듬는 위치나 방식에 따라 좋고 싫음을 섬세하게 표현하나요?",
    weights: { sensitivity: 0.85, sociability: 0.1 },
  },
  {
    id: "SEN05",
    trait: "sensitivity",
    prompt: "갑작스러운 자극이 있어도 별다른 반응 없이 편안한 편인가요?",
    weights: { sensitivity: -1, boldness: 0.2 },
  },
];
