export type DecimalString = string;
export type SignedDecimalString = string;
export type CurrencyCode = string;

type DecimalParts = { coefficient: bigint; scale: number };

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const SIGNED_DECIMAL_PATTERN = /^-?(0|[1-9]\d*)(?:\.(\d+))?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function assertDecimal(value: string, name = "value"): asserts value is DecimalString {
  if (!DECIMAL_PATTERN.test(value)) throw new RangeError(`${name} must be a non-negative plain decimal string`);
}

export function assertSignedDecimal(value: string, name = "value"): asserts value is SignedDecimalString {
  if (!SIGNED_DECIMAL_PATTERN.test(value) || value.startsWith("-0") && compareSignedDecimal(value, "0") === 0) {
    throw new RangeError(`${name} must be a signed plain decimal string`);
  }
}

export function assertCurrency(value: string): asserts value is CurrencyCode {
  if (!CURRENCY_PATTERN.test(value)) throw new RangeError("currency must be an ISO 4217 alpha-3 code");
}

export function compareDecimal(left: DecimalString, right: DecimalString): number {
  const [a, b] = align(parse(left), parse(right));
  return a.coefficient < b.coefficient ? -1 : a.coefficient > b.coefficient ? 1 : 0;
}

export function addDecimal(left: DecimalString, right: DecimalString): DecimalString {
  const [a, b] = align(parse(left), parse(right));
  return format({ coefficient: a.coefficient + b.coefficient, scale: a.scale });
}

export function compareSignedDecimal(left: SignedDecimalString, right: SignedDecimalString): number {
  const [a, b] = align(parseSigned(left), parseSigned(right));
  return a.coefficient < b.coefficient ? -1 : a.coefficient > b.coefficient ? 1 : 0;
}

export function addSignedDecimal(left: SignedDecimalString, right: SignedDecimalString): SignedDecimalString {
  const [a, b] = align(parseSigned(left), parseSigned(right));
  return formatSigned({ coefficient: a.coefficient + b.coefficient, scale: a.scale });
}

export function subtractDecimal(left: DecimalString, right: DecimalString): SignedDecimalString {
  const [a, b] = align(parse(left), parse(right));
  return formatSigned({ coefficient: a.coefficient - b.coefficient, scale: a.scale });
}

export function subtractDecimalFloorZero(left: DecimalString, right: DecimalString): DecimalString {
  const [a, b] = align(parse(left), parse(right));
  return format({ coefficient: a.coefficient > b.coefficient ? a.coefficient - b.coefficient : 0n, scale: a.scale });
}

export function minDecimal(...values: DecimalString[]): DecimalString {
  if (values.length === 0) throw new Error("minDecimal requires a value");
  return values.reduce((minimum, value) => compareDecimal(value, minimum) < 0 ? value : minimum);
}

export function multiplyDecimalByRatio(value: DecimalString, ratio: number): DecimalString {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new RangeError("ratio must be between 0 and 1");
  const valueParts = parse(value);
  const ratioParts = parse(ratio.toString());
  return format({
    coefficient: valueParts.coefficient * ratioParts.coefficient,
    scale: valueParts.scale + ratioParts.scale,
  });
}

export function decimalRatio(numerator: DecimalString, denominator: DecimalString): number {
  if (compareDecimal(denominator, "0") === 0) throw new RangeError("denominator must be positive");
  const [a, b] = align(parse(numerator), parse(denominator));
  const precision = 1_000_000_000n;
  return Number((a.coefficient * precision) / b.coefficient) / Number(precision);
}

function parse(value: string): DecimalParts {
  assertDecimal(value);
  const [whole = "0", fraction = ""] = value.split(".");
  return normalize({ coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length });
}

function parseSigned(value: string): DecimalParts {
  if (!SIGNED_DECIMAL_PATTERN.test(value)) throw new RangeError("value must be a signed plain decimal string");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
  return normalize({ coefficient, scale: fraction.length });
}

function align(left: DecimalParts, right: DecimalParts): [DecimalParts, DecimalParts] {
  const scale = Math.max(left.scale, right.scale);
  return [
    { coefficient: left.coefficient * 10n ** BigInt(scale - left.scale), scale },
    { coefficient: right.coefficient * 10n ** BigInt(scale - right.scale), scale },
  ];
}

function normalize(parts: DecimalParts): DecimalParts {
  let { coefficient, scale } = parts;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  return { coefficient, scale };
}

function format(parts: DecimalParts): DecimalString {
  if (parts.coefficient < 0n) throw new RangeError("unsigned decimal cannot be negative");
  return formatSigned(parts);
}

function formatSigned(parts: DecimalParts): SignedDecimalString {
  const normalized = normalize(parts);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  return `${negative ? "-" : ""}${padded.slice(0, -normalized.scale)}.${padded.slice(-normalized.scale)}`;
}
