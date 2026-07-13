import { z } from "zod";
export const complianceSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const complianceOutputSchema = z.object({ score: z.number().min(0).max(100), passed: z.boolean(), violations: z.array(z.object({ code: z.string(), severity: complianceSeveritySchema, message: z.string(), sourceText: z.string().optional() })), requiredDisclosures: z.array(z.string()) });
export type ComplianceOutput = z.infer<typeof complianceOutputSchema>;
export interface ComplianceInput { body: string; productName: string; categoryPath: string[]; links: string[]; }
const DISCLOSURE = "쿠팡 파트너스 활동으로 일정 수수료를 제공받을 수 있습니다.";
const forbiddenCategories = new Set(["담배", "무기", "불법의약품"]);

export function validateCompliance(input: ComplianceInput): ComplianceOutput {
  const violations: ComplianceOutput["violations"] = [];
  if (!input.body.includes(DISCLOSURE)) violations.push({ code: "MISSING_AFFILIATE_DISCLOSURE", severity: "CRITICAL", message: "필수 제휴 고지 문구가 없습니다." });
  if (/\d[\d,]*\s*원(?:에|으로)?\s*(?:구매|판매|특가)/u.test(input.body)) violations.push({ code: "UNVERIFIED_PRICE_CLAIM", severity: "HIGH", message: "가격을 확정적으로 표현했습니다." });
  if (/(치료|완치|예방 효과|부작용 없음)/u.test(input.body)) violations.push({ code: "HEALTH_CLAIM", severity: "CRITICAL", message: "확인되지 않은 건강 효능 표현이 있습니다." });
  if (input.categoryPath.some((category) => forbiddenCategories.has(category))) violations.push({ code: "FORBIDDEN_CATEGORY", severity: "CRITICAL", message: "금지 카테고리 상품입니다." });
  if (!input.body.includes(input.productName)) violations.push({ code: "PRODUCT_MISMATCH", severity: "HIGH", message: "본문에서 대상 상품을 확인할 수 없습니다." });
  input.links.forEach((link) => { try { const url = new URL(link); if (url.protocol !== "https:") throw new Error("protocol"); } catch { violations.push({ code: "INVALID_LINK", severity: "CRITICAL", message: "유효한 HTTPS 링크가 아닙니다.", sourceText: link }); } });
  const deductions = { LOW: 5, MEDIUM: 10, HIGH: 20, CRITICAL: 100 } as const;
  const score = Math.max(0, 100 - violations.reduce((sum, violation) => sum + deductions[violation.severity], 0));
  return complianceOutputSchema.parse({ score, passed: score >= 95 && !violations.some((violation) => violation.severity === "CRITICAL"), violations, requiredDisclosures: [DISCLOSURE] });
}

export function ensureDisclosure(body: string): string { return body.includes(DISCLOSURE) ? body : `${body}\n\n${DISCLOSURE}`; }
