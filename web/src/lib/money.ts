/**
 * Money is stored as integer **micro-USD** (µUSD): 1 USD = 1,000,000 µUSD.
 * Integer math means no floating-point drift when we accumulate millions of
 * fraction-of-a-cent impression credits. Per-impression credit example:
 *   $5.00 / 1,000 impressions = $0.005 = 5,000 µUSD; the user's 50% = 2,500 µUSD.
 */

export const MICRO_PER_USD = 1_000_000n;

/** Parse a user-facing dollar string ("5", "5.00", "0.01") to µUSD. */
export function usdStringToMicro(s: string): bigint {
  const m = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(s.trim());
  if (!m) throw new Error(`invalid USD amount: ${s}`);
  const sign = m[1] === "-" ? -1n : 1n;
  const whole = BigInt(m[2]) * MICRO_PER_USD;
  const fracDigits = (m[3] ?? "").padEnd(6, "0");
  return sign * (whole + BigInt(fracDigits));
}

/** Dollars (number) → µUSD. For fixed config values, not accumulation. */
export function usdToMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/** µUSD → "X.XX" for display. Number is safe for display-range values. */
export function microToUsdString(micro: bigint): string {
  return (Number(micro) / 1_000_000).toFixed(2);
}

/** Price per 1,000 impressions (µUSD) → credit for one impression at a given
 *  revenue share (default 50% to the user). Floors to whole µUSD. */
export function perImpressionCredit(
  pricePerThousandMicro: bigint,
  shareNum = 1n,
  shareDen = 2n,
): bigint {
  return (pricePerThousandMicro * shareNum) / (1000n * shareDen);
}
