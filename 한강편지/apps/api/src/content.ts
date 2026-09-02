import { AppError } from './errors.js';

const blockedPatterns = [
  /https?:\/\//i,
  /(?:010[-.\s]?\d{3,4}[-.\s]?\d{4})/,
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  /(?:카톡|카카오톡|인스타|텔레그램|오픈채팅)\s*(?:아이디|id|링크)?/i,
  /(?:만나자|만날래|거래하자|입금해|송금해)/i,
];

export function validateLetterBody(input: unknown): string {
  if (typeof input !== 'string') {
    throw new AppError('INVALID_BODY', '편지 내용을 입력해 주세요.');
  }

  const body = input.trim();
  if (body.length < 1 || body.length > 500) {
    throw new AppError('INVALID_BODY_LENGTH', '편지는 1자 이상 500자 이하로 작성해 주세요.');
  }
  if (blockedPatterns.some((pattern) => pattern.test(body))) {
    throw new AppError(
      'CONTENT_REJECTED',
      '연락처, 링크, 만남·거래를 유도하는 표현은 편지에 넣을 수 없어요.',
    );
  }
  return body;
}
