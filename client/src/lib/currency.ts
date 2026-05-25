export function formatNGN(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 1e12) return `\u20A6${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `\u20A6${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `\u20A6${(v / 1e6).toFixed(1)}M`;
  return `\u20A6${v.toLocaleString()}`;
}

export function formatUSD(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export function formatCompact(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export function formatAmountCents(amount: number, currency: string = 'NGN'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '\u00A3' : currency === 'EUR' ? '\u20AC' : '\u20A6';
  return `${symbol}${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
