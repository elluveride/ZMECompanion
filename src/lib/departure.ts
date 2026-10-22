import type { Dataset, Sid, Elvis, Position, HeadingRule, Airport, Flow, Src } from '../../schema/schema';
import type { Flight } from './flight';
import { hdg, parseAlt } from './format';

export type Ctx = { airport: string; flow: string; night: boolean };
export type Side = 'east' | 'west';
export type Direction = 'N' | 'E' | 'S' | 'W';

export type DepFreq = { label: string; freq: string; position?: Position; src: Src[]; note?: string };

export type DeparturePlan = {
  airport?: Airport;
  flow?: Flow;
  sid?: Sid;
  elvis?: Elvis;
  /** Problems with the filed SID/transition (night-only, jets-only…). */
  issues: { text: string; src: Src[] }[];
  side?: Side;
  direction?: Direction;
  initialAlt?: { feet: number; filedLower: boolean; text: string; src: Src[]; flag?: string };
  depFreq?: DepFreq;
  taxiRunways: string[];
  runway?: string;
  runwayReason?: string;
  fix?: { name: string; runwayHeading: boolean; flag?: string; note?: string };
  heading?: { rule: HeadingRule; value: string };
  takeoff: 'rnav' | 'heading' | 'runway-heading' | 'unknown';
};

export const findFlow = (ds: Dataset, airport: string, flow: string): Flow | undefined =>
  ds.flows.find((f) => f.airport === airport && f.id === flow) ?? ds.flows.find((f) => f.airport === airport);

/** Match a filed SID by its base name so "GOETZ", "GOETZ7" and "GOETZ8" all resolve. */
export function findSid(ds: Dataset, airport: string, filed: string): Sid | undefined {
  const t = filed.trim().toUpperCase();
  if (!t) return undefined;
  const base = t.replace(/\d+$/, '');
  return ds.sids.find((s) => s.airport === airport && (s.name.toUpperCase() === t || s.base.toUpperCase() === base));
}

export const findElvis = (ds: Dataset, name: string): Elvis | undefined => ds.elvis.find((e) => e.name === name.trim().toUpperCase());

/** The fix on the SID for a runway, honouring 9/27's vector-to-fix rule. */
export function fixFor(sid: Sid, runway: string): DeparturePlan['fix'] {
  if ((runway === '9' || runway === '27') && (sid.fix_9_27 || sid.fix_9_27_text)) {
    return {
      name: sid.fix_9_27 ?? '',
      runwayHeading: true,
      note: sid.fix_9_27 ? `Fly runway heading; M03 vectors to ${sid.fix_9_27}` : sid.fix_9_27_text,
    };
  }
  const name = sid.fix[runway];
  if (!name) return undefined;
  const flag = Object.entries(sid.flags ?? {}).find(([, fields]) => fields.includes(`fix.${runway}`))?.[0];
  return name === 'RH' ? { name, runwayHeading: true, note: 'Runway heading' } : { name, runwayHeading: false, flag };
}

export function headingValue(rule: HeadingRule, runway?: string): string {
  const h = rule.heading;
  if (typeof h === 'number') return hdg(h);
  if (typeof h === 'string') return h;
  if (runway && h[runway] !== undefined) return hdg(h[runway]);
  return Object.entries(h)
    .map(([r, v]) => `${hdg(v)} off ${r}`)
    .join(', ');
}

/** Most specific heading rule: a rule naming the SID/transition beats a side-only rule. */
export function matchHeading(
  ds: Dataset,
  q: { airport: string; flow?: string; runway?: string; engine: 'jet' | 'prop'; sidBase?: string; elvis?: string; side?: Side },
): HeadingRule | undefined {
  let best: HeadingRule | undefined;
  let bestScore = 0;
  for (const r of ds.headings) {
    if (r.airport !== q.airport) continue;
    if (r.flow && r.flow !== q.flow) continue;
    if (r.runways && !(q.runway && r.runways.includes(q.runway))) continue;
    if (r.aircraft !== 'any' && r.aircraft !== q.engine) continue;
    const listed = r.sids.length > 0 || r.elvis.length > 0;
    let score: number;
    if (listed) score = (q.sidBase && r.sids.includes(q.sidBase)) || (q.elvis && r.elvis.includes(q.elvis)) ? 3 : 0;
    else if (r.side) score = r.side === q.side ? 2 : 0;
    else score = 1;
    if (score > bestScore) [best, bestScore] = [r, score];
  }
  return best;
}

function departureFrequency(ds: Dataset, airport: Airport, side?: Side): DepFreq | undefined {
  if (airport.dep_freq_order?.rows.length) {
    const first = airport.dep_freq_order.rows[0];
    return {
      label: first.label,
      freq: first.freq,
      src: airport.dep_freq_order.src,
      note: 'First staffed option wins — move down the list if it is not manned.',
    };
  }
  const tracon = ds.positions.filter((p) => p.facility === airport.tracon);
  const deps = tracon.filter((p) => p.role === 'DEP');
  const pool = deps.length ? deps : tracon.filter((p) => p.role === 'APP');
  const pick = (side && pool.find((p) => p.side === side)) || (deps.length ? undefined : pool.find((p) => p.primary));
  if (!pick) return undefined;
  return { label: pick.name, freq: pick.freq, position: pick, src: pick.src };
}

export function planDeparture(ds: Dataset, ctx: Ctx, f: Flight): DeparturePlan {
  const plan: DeparturePlan = { issues: [], taxiRunways: [], takeoff: 'unknown' };
  const airport = ds.airports.find((a) => a.id === ctx.airport);
  if (!airport) return plan;
  plan.airport = airport;
  const flow = findFlow(ds, airport.id, ctx.flow);
  plan.flow = flow;

  const sid = findSid(ds, airport.id, f.sid);
  plan.sid = sid;
  const elvis = sid && !sid.rnav ? findElvis(ds, f.transition) : undefined;
  plan.elvis = elvis;
  plan.side = sid?.side ?? elvis?.side;
  plan.direction = sid?.direction ?? elvis?.direction;

  for (const item of [sid, elvis]) {
    if (!item) continue;
    if (item.availability === 'night' && !ctx.night)
      plan.issues.push({
        text: `${item.name} is authorized 0200–0600 local only — otherwise needs pre-arranged M03 approval.`,
        src: item.src,
      });
    if (item.availability === 'coord')
      plan.issues.push({
        text: `${item.name}: ${'availability_note' in item ? item.availability_note : 'pre-arranged M03 coordination only'}.`,
        src: item.src,
      });
  }
  if (sid?.jets_only && f.engine === 'prop') plan.issues.push({ text: 'RNAV SIDs are jets only — props get the ELVIS.', src: sid.src });

  // Initial altitude: the airport's figure, or the filed altitude when that's lower.
  if (airport.initial_alt) {
    const base = f.engine === 'jet' ? airport.initial_alt.jet : airport.initial_alt.prop;
    const filed = parseAlt(f.filedAlt);
    const filedLower = filed !== undefined && filed < base;
    plan.initialAlt = {
      feet: filedLower ? filed : base,
      filedLower,
      text: airport.initial_alt.text,
      src: airport.initial_alt.src,
      flag: airport.initial_alt.flag,
    };
  }

  plan.depFreq = departureFrequency(ds, airport, plan.side);

  if (plan.direction && flow) {
    const rule = ds.taxi.find((t) => t.airport === airport.id && t.direction === plan.direction);
    if (rule && (flow.id === 'north' || flow.id === 'south')) plan.taxiRunways = rule[flow.id];
  }

  // Runway: override → SID's preferred runway for the flow → taxi-by-direction → flow default.
  const departs = flow?.depart ?? [];
  const preferred = flow ? sid?.preferred?.[flow.id] : undefined;
  const byDirection = plan.taxiRunways.find((r) => departs.includes(r));
  if (f.runway && airport.runways.includes(f.runway)) [plan.runway, plan.runwayReason] = [f.runway, 'Set on the flight'];
  else if (preferred && departs.includes(preferred)) [plan.runway, plan.runwayReason] = [preferred, 'SID preferred runway (when busy)'];
  else if (byDirection) [plan.runway, plan.runwayReason] = [byDirection, 'Taxi-by-direction table'];
  else if (departs[0]) [plan.runway, plan.runwayReason] = [departs[0], `${flow?.name} flow departure runway`];

  if (sid && plan.runway) plan.fix = fixFor(sid, plan.runway);

  const rule = matchHeading(ds, {
    airport: airport.id,
    flow: flow?.id,
    runway: plan.runway,
    engine: f.engine,
    sidBase: sid?.base,
    elvis: elvis?.name,
    side: plan.side,
  });
  if (rule) plan.heading = { rule, value: headingValue(rule, plan.runway) };

  if (plan.fix?.runwayHeading) plan.takeoff = 'runway-heading';
  else if (sid?.rnav && plan.fix && f.engine === 'jet' && f.rules === 'IFR') plan.takeoff = 'rnav';
  else if (plan.heading) plan.takeoff = 'heading';
  return plan;
}

/** SIDs to list for an airport; night-only ones are kept but marked when the Night toggle is off. */
export const sidsFor = (ds: Dataset, airport: string) => ds.sids.filter((s) => s.airport === airport);

export const isUnavailable = (s: { availability: string }, night: boolean) => s.availability === 'night' && !night;
