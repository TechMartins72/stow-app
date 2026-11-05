// Fixed-point decimal math for money. Amounts arrive from the Gateway as
// decimal strings; never convert them to JavaScript numbers.

const SCALE = 18;
const ONE = 10n ** BigInt(SCALE);
const PATTERN = /^-?\d+(\.\d+)?$/;

/** A decimal value scaled by 10^18. */
export type Dec = bigint;

export const ZERO: Dec = 0n;

export function dec(value: string): Dec {
  const text = value.trim();
  if (!PATTERN.test(text)) throw new Error(`Not a decimal string: "${value}"`);
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  // Digits past 18 places are truncated; no Gateway amount comes close.
  const scaled = BigInt(whole) * ONE + BigInt(fraction.padEnd(SCALE, "0").slice(0, SCALE));
  return negative ? -scaled : scaled;
}

export function toDecimalString(value: Dec, maxPlaces = SCALE): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / ONE;
  const fraction = (abs % ONE).toString().padStart(SCALE, "0").slice(0, maxPlaces).replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : `${whole}`;
  return negative && text !== "0" ? `-${text}` : text;
}

export function mul(a: Dec, b: Dec): Dec {
  return (a * b) / ONE;
}

export function div(a: Dec, b: Dec): Dec {
  if (b === 0n) throw new Error("Division by zero");
  return (a * ONE) / b;
}

export function min(a: Dec, b: Dec): Dec {
  return a < b ? a : b;
}

export function max(a: Dec, b: Dec): Dec {
  return a > b ? a : b;
}

export function sum(values: Dec[]): Dec {
  return values.reduce((total, v) => total + v, ZERO);
}
