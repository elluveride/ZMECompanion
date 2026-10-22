import type { Dataset } from '../../schema/schema';
import type { Flight } from './flight';
import type { DeparturePlan } from './departure';
import { altText, ft, parseAlt } from './format';

export type Segment = { text: string; slot?: string; filled?: boolean };
export type SlotValues = Record<string, string | undefined>;

/** Split a template into literal text and {slot}s, filled where a value exists. */
export function fillTemplate(template: string, values: SlotValues): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{([a-z0-9_]+)\}/g)) {
    if (m.index! > last) out.push({ text: template.slice(last, m.index) });
    const v = values[m[1]]?.trim();
    out.push(v ? { text: v, slot: m[1], filled: true } : { text: `{${m[1]}}`, slot: m[1], filled: false });
    last = m.index! + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}

export const segmentsToText = (segs: Segment[]) => segs.map((s) => s.text).join('');

const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
/** "GOETZ7" → "GOETZ SEVEN" (procedure names are spoken with the number as a word). */
export const sayProcedure = (name: string) => name.replace(/^([A-Z]+)(\d)$/, (_, b: string, d: string) => `${b} ${WORDS[+d]}`);

/** Everything the top bar and active flight can fill. */
export function slotValues(ds: Dataset, airportId: string, f: Flight, plan: DeparturePlan): SlotValues {
  const twr = ds.positions.find((p) => p.facility === airportId && p.role === 'TWR' && p.primary);
  const filed = parseAlt(f.filedAlt);
  return {
    callsign: f.callsign.toUpperCase() || undefined,
    dest: f.dest.toUpperCase() || undefined,
    sid: plan.sid ? sayProcedure(plan.sid.name) : undefined,
    transition: f.transition.toUpperCase() || plan.sid?.transition,
    alt: plan.initialAlt ? ft(plan.initialAlt.feet) : undefined,
    filed: filed !== undefined ? altText(filed) : undefined,
    depfreq: plan.depFreq?.freq,
    depradio: plan.depFreq?.position?.radio ?? plan.depFreq?.label,
    squawk: f.squawk || undefined,
    rwy: plan.runway,
    fix: plan.fix && !plan.fix.runwayHeading ? plan.fix.name : undefined,
    hdg: plan.heading && /^\d{3}$/.test(plan.heading.value) ? plan.heading.value : undefined,
    twrfreq: twr?.freq,
    twrradio: twr?.radio,
  };
}
