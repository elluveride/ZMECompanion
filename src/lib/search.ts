import type { Dataset } from '../../schema/schema';

export type Hit = {
  label: string;
  kind: string;
  detail: string;
  /** Hash route to open, e.g. "#/del?apt=MEM&tab=ref" */
  href: string;
  keys: string;
};

const route = (page: string, apt?: string, tab?: string) => {
  const q = new URLSearchParams();
  if (apt) q.set('apt', apt);
  if (tab) q.set('tab', tab);
  const s = q.toString();
  return `#/${page}${s ? `?${s}` : ''}`;
};

const PAGE: Record<string, string> = { DEL: 'del', GND: 'gnd', TWR: 'twr', APP: 'app', DEP: 'app', ATIS: 'del', CTR: 'ctr' };

/** Flat index over fixes, SIDs, STARs, callsigns, frequencies, scratchpads, VORs and airports. */
export function buildIndex(ds: Dataset): Hit[] {
  const hits: Hit[] = [];
  const add = (h: Omit<Hit, 'keys'>, ...extra: (string | undefined)[]) =>
    hits.push({ ...h, keys: [h.label, h.detail, ...extra].filter(Boolean).join(' ').toUpperCase() });

  for (const a of ds.airports) {
    const href = a.group === 'satellite' ? route('app', 'MEM') : route('del', a.id);
    add({ label: a.icao, kind: a.group === 'satellite' ? 'Satellite' : 'Airport', detail: a.name, href }, a.id);
  }

  const fixes = new Map<string, Set<string>>();
  const fix = (name: string | undefined, via: string) => {
    if (!name || name === 'RH') return;
    for (const n of name.split(/,\s*/)) (fixes.get(n) ?? fixes.set(n, new Set()).get(n)!).add(via);
  };
  for (const s of ds.sids) {
    const fixList = [...new Set(Object.values(s.fix))].filter((v) => v !== 'RH');
    add(
      {
        label: s.name,
        kind: `SID · ${s.airport}`,
        detail: [s.say && `“${s.say}”`, s.transition && `trans ${s.transition}`, fixList.join('/'), s.availability === 'night' && 'night only']
          .filter(Boolean)
          .join(' · '),
        href: route('del', s.airport, 'ref'),
      },
      s.base,
    );
    fix(s.transition, `${s.name} transition`);
    for (const v of fixList) fix(v, `${s.name} initial fix`);
    fix(s.fix_9_27, `${s.name} 9/27 fix`);
    fix(s.waypoint, `${s.name} waypoint`);
    fix(s.gate, `${s.name} ELVIS gate`);
  }
  for (const e of ds.elvis)
    add({
      label: e.name,
      kind: 'ELVIS transition',
      detail: `${e.direction} gate · ${e.side}${e.availability !== 'always' ? ` · ${e.availability}` : ''}`,
      href: route('del', 'MEM', 'ref'),
    });
  for (const s of ds.stars)
    add(
      {
        label: s.name,
        kind: `STAR · ${s.airport}`,
        detail: [s.type.replace('_', ' '), s.runways.join('/')].filter(Boolean).join(' · '),
        href: route('app', s.airport, 'ref'),
      },
      s.alias,
    );
  for (const a of ds.airports) for (const r of a.approaches?.rows ?? []) fix(r.iaf, `${a.id} ${r.rwy} IAF`);
  for (const [name, via] of fixes)
    if (!hits.some((h) => h.label === name)) add({ label: name, kind: 'Fix', detail: [...via].join(' · '), href: route('del', 'MEM', 'ref') });

  for (const p of ds.positions) {
    const apt = ds.airports.find((a) => a.id === p.facility || a.tracon === p.facility);
    add(
      { label: p.callsign ?? p.name, kind: 'Position', detail: `${p.radio ?? p.name} · ${p.freq}`, href: route(PAGE[p.role] ?? 'del', apt?.id) },
      p.freq,
      p.name,
    );
  }
  for (const s of ds.enroute.sectors)
    add(
      { label: s.callsign, kind: `Sector ${s.stratum.toUpperCase()}`, detail: `${s.name} ${s.id} · ${s.freq}`, href: route('ctr', undefined, 'ref') },
      s.freq,
      s.name,
    );
  for (const n of ds.enroute.neighbours) add({ label: n.id, kind: 'Neighbour', detail: `${n.name} · ${n.freq}`, href: route('ctr') }, n.freq);

  for (const s of ds.approach.scratchpads) {
    add({ label: s.instrument, kind: 'Scratchpad', detail: `Instrument approach runway ${s.runway}`, href: route('app', 'MEM', 'ref') });
  }
  for (const s of [...ds.approach.secondary_scratchpads, ...ds.approach.satellite_scratchpads])
    add({ label: s.code, kind: 'Scratchpad', detail: s.meaning, href: route('app', s.facility === 'M03' ? 'MEM' : 'JAN', 'ref') });
  for (const v of ds.references.vors.rows) add({ label: v.id, kind: 'VOR', detail: v.name, href: route('ctr', undefined, 'ref') });
  for (const r of ds.enroute.loa_rules)
    add({ label: r.destination, kind: `LOA · ${r.neighbour}`, detail: r.restriction, href: route('ctr', undefined, 'ref') });
  return hits;
}

export function search(index: Hit[], query: string, limit = 12): Hit[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const scored: [number, Hit][] = [];
  for (const h of index) {
    const label = h.label.toUpperCase();
    const score = label === q ? 0 : label.startsWith(q) ? 1 : h.keys.includes(q) ? 2 : -1;
    if (score >= 0) scored.push([score, h]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label))
    .slice(0, limit)
    .map(([, h]) => h);
}
