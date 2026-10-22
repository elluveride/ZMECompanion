import type { Dataset, Strips } from '../../schema/schema';
import type { Flight } from './flight';
import type { DeparturePlan } from './departure';
import type { PdcResult } from './pdc';
import { hundreds, parseAlt } from './format';

type Nav = 'none' | 'dme' | 'tacan' | 'rnav' | 'gnss';
type Xpdr = 'none' | 'no_c' | 'mode_c';
export type Capabilities = { rvsm: boolean; nav: Nav; xpdr: Xpdr };

/** ICAO Item 10 ("SDE3FGHIRWY/LB1") → capabilities. Returns undefined for anything else. */
export function capabilitiesFromIcao(equipment: string, codes: Strips['icao_item10']): Capabilities | undefined {
  const m = /^([A-Z0-9]+)\/([A-Z0-9]*)$/.exec(equipment.trim().toUpperCase());
  if (!m) return undefined;
  const [, a, b] = m;
  // Item 10a: drop letter+digit pairs (E3, J1, M1, P2…) so only single-letter codes remain.
  const letters = new Set(a.replace(/[A-Z]\d/g, '').split(''));
  const has = (list: string[]) => list.some((c) => letters.has(c));
  const nav: Nav = has(codes.gnss) ? 'gnss' : has(codes.rnav) ? 'rnav' : has(codes.tacan) ? 'tacan' : has(codes.dme) ? 'dme' : 'none';
  const ssr = /^[A-Z](?!\d)/.exec(b)?.[0];
  const xpdr: Xpdr =
    !ssr || codes.xpdr_none.includes(ssr) ? 'none' : codes.xpdr_mode_c.includes(ssr) ? 'mode_c' : codes.xpdr_no_c.includes(ssr) ? 'no_c' : 'none';
  return { rvsm: has(codes.rvsm), nav, xpdr };
}

/** TBL 2-3-10 lookup. RVSM only has rows with Mode C; otherwise fall back to the non-RVSM rows. */
export function suffixFor(c: Capabilities, table: Strips['equipment_suffixes']['rows']): string | undefined {
  if (c.rvsm && c.xpdr === 'mode_c') {
    const nav = c.nav === 'gnss' || c.nav === 'rnav' ? c.nav : 'none';
    const row = table.find((r) => r.rvsm && r.nav === nav && r.xpdr === 'mode_c');
    if (row) return row.suffix;
  }
  return table.find((r) => !r.rvsm && r.nav === c.nav && r.xpdr === c.xpdr)?.suffix;
}

/** Suffix from whatever the user pasted: a bare suffix ("L"), "/L", or an ICAO Item 10 string. */
export function deriveSuffix(equipment: string, strips: Strips): string | undefined {
  const t = equipment.trim().toUpperCase().replace(/^\//, '');
  if (/^[A-Z]$/.test(t) && strips.equipment_suffixes.rows.some((r) => r.suffix === t)) return t;
  const caps = capabilitiesFromIcao(t, strips.icao_item10);
  return caps ? suffixFor(caps, strips.equipment_suffixes.rows) : undefined;
}

export type StripExtras = {
  count: string;
  star: string;
  prevFix: string;
  coordFix: string;
  eta: string;
  arrRunway: string;
  approach: 'instrument' | 'visual';
  ovfRoute: string;
  box: Record<string, string>;
};

export const EMPTY_EXTRAS: StripExtras = {
  count: '',
  star: '',
  prevFix: '',
  coordFix: '',
  eta: '',
  arrRunway: '',
  approach: 'instrument',
  ovfRoute: '',
  box: {},
};

export type StripValues = Record<string, string>;

/** Every `field` key a strip box can show. Manual box edits (extras.box) win. */
export function stripValues(
  ds: Dataset,
  f: Flight,
  plan: DeparturePlan,
  pdc: PdcResult | undefined,
  x: StripExtras,
  arrival: { runway?: string; scratchpad?: string },
): StripValues {
  const suffix = deriveSuffix(f.equipment, ds.strips);
  const type = f.type.toUpperCase();
  const typeBox = [x.count && Number(x.count) > 1 ? x.count : '', f.wake ? `${f.wake.toUpperCase()}/` : '', type, type && suffix ? `/${suffix}` : ''].join('');
  const filed = parseAlt(f.filedAlt);
  const sidPart = plan.sid ? [plan.sid.name, f.transition || plan.sid.transition].filter(Boolean).join('.') : '';
  const climb = plan.initialAlt ? `↑${hundreds(plan.initialAlt.feet)}` : '';
  const takeoff = plan.takeoff === 'rnav' ? plan.fix?.name : plan.takeoff === 'runway-heading' ? 'RH' : plan.heading?.value;
  const values: StripValues = {
    callsign: f.callsign.toUpperCase(),
    type_box: typeBox,
    cid: f.cid,
    squawk: f.squawk,
    etd: f.etd,
    req_alt: filed !== undefined ? hundreds(filed) : '',
    dep: f.dep.toUpperCase() || plan.airport?.icao || '',
    route_box: [sidPart, f.route.toUpperCase(), f.dest.toUpperCase(), climb].filter(Boolean).join(' '),
    pdc: pdc?.result ?? '',
    prev_fix: x.prevFix.toUpperCase(),
    coord_fix: x.coordFix.toUpperCase(),
    eta: x.eta,
    arr_box: [filed !== undefined ? hundreds(filed) : '', x.star.toUpperCase(), arrival.runway ? `RWY ${arrival.runway}` : '', arrival.scratchpad ?? '']
      .filter(Boolean)
      .join(' '),
    ovf_box: [filed !== undefined ? hundreds(filed) : '', x.ovfRoute.toUpperCase()].filter(Boolean).join(' '),
    dep_rwy: plan.runway ?? '',
    fix_or_hdg: takeoff ?? '',
    depfreq: plan.depFreq?.freq ?? '',
    clr_status: '',
    atd: '',
  };
  return values;
}
