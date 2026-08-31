/**
 * 문항·가중치 또는 결과 변환식이 바뀌면 값을 올린다.
 * 이전 버전의 답변으로 새 결과를 계산하지 않도록 저장소 migration에서 사용한다.
 */
export const QUESTION_SET_VERSION = "v0.1-reconstructed.1";
export const SCORING_VERSION = "v0.1-reconstructed.1";

export const ASSESSMENT_VERSION = `${QUESTION_SET_VERSION}:${SCORING_VERSION}`;
