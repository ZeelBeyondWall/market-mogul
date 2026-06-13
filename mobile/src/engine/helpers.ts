export function fmt(n: number, dec = 2): string {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e15) return sign + '$' + (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return sign + '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return sign + '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return sign + '$' + (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return sign + '$' + (n / 1e3).toFixed(2)  + 'K';
  return sign + '$' + n.toFixed(dec);
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + 'K';
  return Math.floor(n).toString();
}

export function fmtShares(n: number): string {
  return fmtNum(n);
}

export function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function roundShares(n: number): number {
  return Math.floor(n);
}

export function calcEMA(prev: number | null, val: number, alpha: number): number {
  return prev == null ? val : prev * (1 - alpha) + val * alpha;
}

export function calcRSI(arr: number[]): number {
  if (arr.length < 14) return 50;
  let gain = 0, loss = 0;
  for (let i = arr.length - 14; i < arr.length - 1; i++) {
    const d = arr[i + 1] - arr[i];
    if (d > 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}
