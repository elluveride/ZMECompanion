import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { FILES, type FileName, type Parsed, type Doc, type Script, type Src, type Dataset, FREQ_RE } from './schema';

export type { Dataset };

export class DataError extends Error {
  constructor(public problems: string[]) {
    super(`ZME data failed validation (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`);
  }
}

export const ZME_FILE_URL = (siteId: string) => `https://memphisartcc.com/files/${siteId}/download`;

/** Read every data/*.yaml file. */
export function readDataDir(dir: string): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.yaml')) continue;
    raw[basename(f, '.yaml')] = parseYaml(readFileSync(join(dir, f), 'utf8'));
  }
  return raw;
}

export function loadDataset(dir: string): Dataset {
  return buildDataset(readDataDir(dir));
}

/** Validate raw YAML objects against the schema and check every cross-reference. */
export function buildDataset(raw: Record<string, unknown>): Dataset {
  const problems: string[] = [];
  const parsed = {} as Parsed;

  for (const key of Object.keys(raw)) {
    if (!(key in FILES)) problems.push(`data/${key}.yaml: unknown file (add it to FILES in schema/schema.ts)`);
  }
  for (const key of Object.keys(FILES) as FileName[]) {
    if (!(key in raw)) {
      problems.push(`data/${key}.yaml: missing`);
      continue;
    }
    const res = FILES[key].safeParse(raw[key]);
    if (res.success) (parsed as Record<string, unknown>)[key] = res.data;
    else for (const issue of res.error.issues) problems.push(`data/${key}.yaml ${issue.path.join('.')}: ${issue.message}`);
  }
  if (problems.length) throw new DataError(problems);

  checkReferences(parsed, problems);
  if (problems.length) throw new DataError(problems);

  const docs: Doc[] = parsed.docs.map((d) => ({ ...d, url: d.site_id ? ZME_FILE_URL(d.site_id) : d.url }));
  const scripts: Script[] = parsed.scripts.map((s) => ({ ...s, slots: slotsOf(s.template) }));
  return { ...parsed, docs, scripts, citations: countCitations(parsed) };
}

export function slotsOf(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]))];
}

/** Walk any value and yield every { src } array and flag reference with a path. */
function* walk(value: unknown, path: string): Generator<{ path: string; srcs?: Src[]; flags?: string[] }> {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walk(value[i], `${path}[${i}]`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  const flags: string[] = [];
  if (typeof obj.flag === 'string') flags.push(obj.flag);
  if (obj.flags && typeof obj.flags === 'object') flags.push(...Object.keys(obj.flags));
  if (Array.isArray(obj.src) || flags.length) yield { path, srcs: obj.src as Src[] | undefined, flags };
  for (const [k, v] of Object.entries(obj)) if (k !== 'src' && k !== 'flags') yield* walk(v, `${path}.${k}`);
}

function checkReferences(p: Parsed, problems: string[]) {
  const docIds = new Set(p.docs.map((d) => d.id));
  const flagIds = new Set(p.discrepancies.map((d) => d.id));
  const referencedFlags = new Set<string>();
  const dupes = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label}: duplicate id ${id}`);
      seen.add(id);
    }
  };
  dupes(
    'docs',
    p.docs.map((d) => d.id),
  );
  dupes(
    'airports',
    p.airports.map((a) => a.id),
  );
  dupes(
    'positions',
    p.positions.map((x) => x.id),
  );
  dupes(
    'sids',
    p.sids.map((s) => `${s.airport}:${s.name}`),
  );
  dupes(
    'scripts',
    p.scripts.map((s) => s.id),
  );
  dupes(
    'rules',
    p.rules.map((r) => r.id),
  );
  dupes(
    'ait',
    p.ait.map((a) => a.id),
  );
  dupes(
    'discrepancies',
    p.discrepancies.map((d) => d.id),
  );

  for (const d of p.docs) {
    if (d.category !== 'external' && !d.site_id) problems.push(`docs ${d.id}: ZME files need a site_id`);
    if (d.category === 'reference' && d.id === 'reference-card' && !d.airac) problems.push('docs reference-card: needs airac');
  }

  // Every record must carry a source, and every source/flag must resolve.
  const needsSrc: Array<[string, unknown[]]> = [
    ['airports', p.airports],
    ['positions', p.positions],
    ['flows', p.flows],
    ['sids', p.sids],
    ['elvis', p.elvis],
    ['stars', p.stars],
    ['headings', p.headings],
    ['taxi', p.taxi],
    ['ait', p.ait],
    ['rules', p.rules],
    ['enroute.sectors', p.enroute.sectors],
    ['enroute.splits', p.enroute.splits],
    ['enroute.neighbours', p.enroute.neighbours],
    ['enroute.loa_rules', p.enroute.loa_rules],
    ['enroute.arrival_restrictions', p.enroute.arrival_restrictions],
    ['approach.scratchpads', p.approach.scratchpads],
    ['approach.secondary_scratchpads', p.approach.secondary_scratchpads],
    ['approach.satellite_scratchpads', p.approach.satellite_scratchpads],
  ];
  for (const [label, rows] of needsSrc) {
    rows.forEach((r, i) => {
      const src = (r as { src?: Src[] }).src;
      if (!src?.length) problems.push(`${label}[${i}]: missing src`);
    });
  }
  for (const [file, value] of Object.entries(p)) {
    if (file === 'docs') continue;
    for (const hit of walk(value, file)) {
      for (const s of hit.srcs ?? []) if (!docIds.has(s.doc)) problems.push(`${hit.path}: unknown src doc "${s.doc}"`);
      for (const f of hit.flags ?? []) {
        if (!flagIds.has(f)) problems.push(`${hit.path}: unknown discrepancy "${f}"`);
        referencedFlags.add(f);
      }
    }
  }
  for (const d of p.discrepancies) for (const v of d.values) if (!docIds.has(v.src.doc)) problems.push(`discrepancies ${d.id}: unknown src doc "${v.src.doc}"`);

  // Airports, runways, flows.
  const airports = new Map(p.airports.map((a) => [a.id, a]));
  const rwyOk = (apt: string, rwy: string, where: string) => {
    const a = airports.get(apt);
    if (!a) return problems.push(`${where}: unknown airport "${apt}"`);
    if (!a.runways.includes(rwy)) problems.push(`${where}: runway ${rwy} is not in ${apt}'s runway list`);
  };
  const flowIds = new Map<string, Set<string>>();
  p.flows.forEach((f, i) => {
    if (!flowIds.has(f.airport)) flowIds.set(f.airport, new Set());
    flowIds.get(f.airport)!.add(f.id);
    for (const r of [...f.depart, ...f.arrive, ...f.optional]) rwyOk(f.airport, r, `flows[${i}] ${f.airport}/${f.id}`);
  });
  for (const a of p.airports) {
    if (a.calm_flow && a.group !== 'satellite' && !flowIds.get(a.id)?.has(a.calm_flow))
      problems.push(`airports ${a.id}: calm_flow "${a.calm_flow}" has no matching flow`);
    for (const ap of a.approaches?.rows ?? []) rwyOk(a.id, ap.rwy, `airports ${a.id} approaches`);
  }

  // Positions → facilities.
  const facilities = new Set<string>(['ZME', ...p.airports.map((a) => a.id), ...p.airports.map((a) => a.tracon)]);
  p.positions.forEach((x) => {
    if (!facilities.has(x.facility)) problems.push(`positions ${x.id}: unknown facility "${x.facility}"`);
  });

  // SIDs / ELVIS / STARs / headings / taxi.
  const sidBases = new Map<string, Set<string>>();
  p.sids.forEach((s) => {
    if (!sidBases.has(s.airport)) sidBases.set(s.airport, new Set());
    sidBases.get(s.airport)!.add(s.base);
    for (const r of Object.keys(s.fix)) rwyOk(s.airport, r, `sids ${s.name}.fix`);
    for (const r of Object.values(s.preferred ?? {})) rwyOk(s.airport, r, `sids ${s.name}.preferred`);
    if (s.rnav && !Object.keys(s.fix).length) problems.push(`sids ${s.name}: RNAV SID without initial fixes`);
  });
  const elvisNames = new Set(p.elvis.map((e) => e.name));
  p.stars.forEach((s) => s.runways.forEach((r) => rwyOk(s.airport, r, `stars ${s.name}`)));
  p.headings.forEach((h, i) => {
    const where = `headings[${i}] ${h.airport} ${h.group}`;
    if (!airports.has(h.airport)) problems.push(`${where}: unknown airport`);
    if (h.flow && !flowIds.get(h.airport)?.has(h.flow)) problems.push(`${where}: unknown flow "${h.flow}"`);
    h.runways?.forEach((r) => rwyOk(h.airport, r, where));
    if (typeof h.heading === 'object') Object.keys(h.heading).forEach((r) => rwyOk(h.airport, r, where));
    h.sids.forEach((s) => sidBases.get(h.airport)?.has(s) || problems.push(`${where}: unknown SID "${s}"`));
    h.elvis.forEach((e) => elvisNames.has(e) || problems.push(`${where}: unknown ELVIS transition "${e}"`));
  });
  p.taxi.forEach((t) => [...t.north, ...t.south].forEach((r) => rwyOk(t.airport, r, `taxi ${t.direction}`)));

  // Scripts / rules / enroute.
  p.scripts.forEach((s) => s.airports?.forEach((a) => airports.has(a) || problems.push(`scripts ${s.id}: unknown airport "${a}"`)));
  p.rules.forEach((r) => r.airport && !airports.has(r.airport) && problems.push(`rules ${r.id}: unknown airport "${r.airport}"`));
  const sectorIds = new Set(p.enroute.sectors.map((s) => s.id));
  p.enroute.splits.forEach((s) => s.positions.forEach((x) => sectorIds.has(x.sector) || problems.push(`splits ${s.label}: unknown sector ${x.sector}`)));
  p.enroute.neighbours.forEach((n) => docIds.has(n.loa) || problems.push(`neighbours ${n.id}: unknown LOA doc "${n.loa}"`));
  const neighbourIds = new Set(p.enroute.neighbours.map((n) => n.id));
  p.enroute.loa_rules.forEach((r) => neighbourIds.has(r.neighbour) || problems.push(`loa_rules: unknown neighbour ${r.neighbour}`));
  p.ait.forEach((a) => a.sectors.forEach((s) => sectorIds.has(s) || problems.push(`ait ${a.id}: unknown sector ${s}`)));

  // Belt and braces for frequencies typed outside the Freq schema type.
  for (const d of p.airports) for (const r of d.dep_freq_order?.rows ?? []) if (!FREQ_RE.test(r.freq)) problems.push(`airports ${d.id}: bad freq ${r.freq}`);

  for (const d of p.discrepancies) if (!referencedFlags.has(d.id)) problems.push(`discrepancies ${d.id}: no record carries this flag`);
}

const PAGE_OF: Record<string, string[]> = {
  airports: ['DEL', 'GND', 'TWR', 'APP'],
  positions: ['DEL', 'GND', 'TWR', 'APP', 'CTR'],
  flows: ['GND', 'TWR', 'APP'],
  sids: ['DEL', 'GND', 'TWR'],
  elvis: ['DEL', 'TWR'],
  stars: ['APP', 'CTR'],
  headings: ['TWR'],
  taxi: ['GND'],
  approach: ['APP'],
  enroute: ['CTR'],
  ait: ['CTR'],
  scripts: [],
  references: ['DEL', 'APP', 'CTR'],
  strips: ['STRIP'],
};

function countCitations(p: Parsed): Dataset['citations'] {
  const acc: Record<string, Record<string, Set<string>>> = {};
  const add = (s: Src, page: string) => {
    const byPage = (acc[s.doc] ??= {});
    (byPage[page] ??= new Set()).add(s.sec ?? '');
  };
  for (const [file, value] of Object.entries(p)) {
    if (file === 'docs' || file === 'discrepancies' || file === 'questions') continue;
    for (const hit of walk(value, file)) {
      const pages = file === 'rules' ? [ruleScope(p, hit.path)] : (PAGE_OF[file] ?? []);
      for (const s of hit.srcs ?? []) for (const page of pages) if (page) add(s, page);
    }
  }
  for (const sc of p.scripts) for (const s of sc.src ?? []) add(s, sc.role);
  const out: Dataset['citations'] = {};
  for (const [doc, byPage] of Object.entries(acc)) {
    out[doc] = {};
    for (const [page, secs] of Object.entries(byPage)) out[doc][page] = [...secs].filter(Boolean).sort(naturalCompare);
  }
  return out;
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function ruleScope(p: Parsed, path: string): string {
  const m = /^rules\[(\d+)\]/.exec(path);
  return (m && p.rules[Number(m[1])]?.scope) || '';
}
