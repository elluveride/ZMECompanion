/** 5000 → "5,000" */
export const ft = (n: number) => n.toLocaleString('en-US');

/** 15 → "015" */
export const hdg = (n: number) => String(n).padStart(3, '0');

/** Filed altitude in feet → spoken/printed form: 35000 → "FL350", 9000 → "9,000". */
export const altText = (feet: number) => (feet >= 18000 ? `FL${Math.round(feet / 100)}` : ft(feet));

/** Altitude in hundreds for a strip box: 35000 → "350", 5000 → "50". */
export const hundreds = (feet: number) => String(Math.round(feet / 100));

/** Parse "FL350", "350", "35000", "9,000" → feet. */
export function parseAlt(text: string): number | undefined {
  const t = text.trim().toUpperCase().replace(/,/g, '');
  if (!t) return undefined;
  const fl = /^FL(\d{2,3})$/.exec(t);
  if (fl) return Number(fl[1]) * 100;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n < 1000 ? n * 100 : n;
}
