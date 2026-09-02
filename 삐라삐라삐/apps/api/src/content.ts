import { AppError } from './errors.js';

const blockedPatterns: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /https?:\/\//i, message: '링크는 담을 수 없어요.' },
  { pattern: /(?:010[-.\s]?\d{3,4}[-.\s]?\d{4})/, message: '전화번호는 담을 수 없어요.' },
  { pattern: /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, message: '이메일은 담을 수 없어요.' },
  {
    pattern: /(?:카톡|카카오톡|인스타|텔레그램|오픈채팅)은?\s*(?:아이디|id|링크)?/i,
    message: 'SNS나 오픈채팅 정보는 담을 수 없어요.',
  },
  {
    pattern: /(?:만나자|만날래|거래하자|입금해|송금해|찾아갈게)/i,
    message: '만남·거래를 유도하는 내용은 담을 수 없어요.',
  },
  {
    pattern: /(?:죽여버려|폭발물|테러|칼로|불지르|보복할)/i,
    message: '협박이나 위험을 예고하는 내용은 담을 수 없어요.',
  },
  {
    pattern: /(?:투표해|찍어주세요|기호\s*\d+|입당|낙선운동)/i,
    message: '정치 선전이나 선거운동 내용은 담을 수 없어요.',
  },
  {
    pattern: /(?:선착순\s*할인|쿠폰\s*발급|구매\s*문의|판매\s*중)/i,
    message: '광고나 판매 목적의 내용은 담을 수 없어요.',
  },
  {
    pattern: /(?:서울|부산|인천|대전|대구|광주|울산)[^\n]{0,18}(?:로|길)\s*\d{1,4}/,
    message: '구체적인 주소는 담을 수 없어요.',
  },
];

export function validateFlyerBody(input: unknown): string {
  if (typeof input !== 'string') {
    throw new AppError('INVALID_BODY', '삐라 내용을 입력해 주세요.');
  }

  const body = input.trim();
  if (body.length < 1 || body.length > 500) {
    throw new AppError('INVALID_BODY_LENGTH', '삐라는 1자 이상 500자 이하로 작성해 주세요.');
  }
  const blocked = blockedPatterns.find(({ pattern }) => pattern.test(body));
  if (blocked) throw new AppError('CONTENT_REJECTED', blocked.message);
  return body;
}
