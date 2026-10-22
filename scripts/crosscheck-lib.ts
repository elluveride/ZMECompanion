import type { Dataset } from '../schema/schema';

export type Finding = { level: 'conflict' | 'warn'; text: string; known?: string };

const firstNumber = (s: string) => Number(/[\d,]+/.exec(s)?.[0]?.replace(/,/g, ''));

export function crossCheck(ds: Dataset): Finding[] {
  const out: Finding[] = [];

  // 1. One callsign, one frequency — across positions, the sector list and split tables.
  const byCallsign = new Map<string, { freq: string; where: string; flag?: string }[]>();
  const add = (cs: string | undefined, freq: string, where: string, flag?: string) => {
    if (!cs) return;
    if (!byCallsign.has(cs)) byCallsign.set(cs, []);
    byCallsign.get(cs)!.push({ freq, where, flag });
  };
  for (const p of ds.positions) add(p.callsign, p.freq, `positions ${p.id}`);
  for (const s of ds.enroute.sectors) add(s.callsign, s.freq, `sector ${s.id}`, Object.keys(s.flags ?? {})[0]);
  for (const sp of ds.enroute.splits)
    for (const p of sp.positions) if (p.freq) add(ds.enroute.sectors.find((s) => s.id === p.sector)?.callsign, p.freq, `split ${sp.label}`, p.flag);
  for (const [cs, seen] of byCallsign) {
    const freqs = new Set(seen.map((s) => s.freq));
    if (freqs.size > 1)
      out.push({
        level: 'conflict',
        text: `${cs} has frequencies ${[...freqs].join(' vs ')} (${seen.map((s) => s.where).join(', ')})`,
        known: seen.find((s) => s.flag)?.flag,
      });
  }

  // 2. Two positions in one facility sharing a frequency.
  const byFacilityFreq = new Map<string, string[]>();
  for (const p of ds.positions) {
    const k = `${p.facility}:${p.freq}`;
    byFacilityFreq.set(k, [...(byFacilityFreq.get(k) ?? []), p.id]);
  }
  for (const [k, ids] of byFacilityFreq) if (ids.length > 1) out.push({ level: 'warn', text: `${k.replace(':', ' shares ')} between ${ids.join(', ')}` });

  // 3. Airport initial altitude vs the Reference Card's guidance row.
  for (const row of ds.references.initial_altitude_guidance.rows) {
    const a = ds.airports.find((x) => x.id === row.airport);
    if (!a?.initial_alt) continue;
    const card = firstNumber(row.value);
    if (card !== a.initial_alt.jet)
      out.push({
        level: 'conflict',
        text: `${a.id} initial altitude: Reference Card ${row.value} vs ${a.initial_alt.src[0].doc} ${a.initial_alt.jet}`,
        known: row.flag ?? a.initial_alt.flag,
      });
  }

  // 4. Reference Card SID fixes vs the RNAV Departure Reference, runway by runway.
  for (const sid of ds.sids) {
    for (const [rwy, other] of Object.entries(sid.dep_ref ?? {})) {
      const card = sid.fix[rwy];
      if (!card || card === other) continue;
      const known = Object.entries(sid.flags ?? {}).find(([, f]) => f.includes(`fix.${rwy}`))?.[0];
      out.push({ level: 'conflict', text: `${sid.name} ${rwy}: Reference Card ${card} vs RNAV Departure Reference ${other}`, known });
    }
  }

  return out;
}
