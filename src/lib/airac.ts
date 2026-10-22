// AIRAC cycles are 28 days apart. AIRAC 2001 became effective 2020-01-02; the Reference Card's
// "AIRAC 2604 REVISION 16 APR 2026" lines up with this epoch.
const EPOCH = Date.UTC(2020, 0, 2);
const DAY = 86_400_000;
const CYCLE = 28 * DAY;

export type Airac = { ident: string; effective: Date };

export function airacFor(date: Date): Airac {
  const k = Math.floor((date.getTime() - EPOCH) / CYCLE);
  const effective = new Date(EPOCH + k * CYCLE);
  const year = effective.getUTCFullYear();
  const firstK = Math.ceil((Date.UTC(year, 0, 1) - EPOCH) / CYCLE);
  const seq = k - firstK + 1;
  return { ident: `${String(year % 100).padStart(2, '0')}${String(seq).padStart(2, '0')}`, effective };
}

/** True when a document's AIRAC ident is older than the cycle in force on `date`. */
export const isStaleAirac = (docAirac: string | undefined, date: Date) => !!docAirac && docAirac < airacFor(date).ident;
