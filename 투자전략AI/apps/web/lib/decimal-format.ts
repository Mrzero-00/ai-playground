export function formatDecimalString(value: string, options: { currency?: string; maximumFractionDigits?: number } = {}): string {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new Error("invalid Decimal string");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const maximum = options.maximumFractionDigits ?? fraction.length;
  const visibleFraction = fraction.slice(0, maximum).replace(/0+$/, "");
  const number = `${negative ? "-" : ""}${grouped}${visibleFraction ? `.${visibleFraction}` : ""}`;
  return options.currency ? `${number} ${options.currency}` : number;
}
