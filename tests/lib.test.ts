import { describe, expect, it } from 'vitest';
import { loadDataset } from '../schema/build';
import { airacFor, isStaleAirac } from '../src/lib/airac';
import { towerStatus } from '../src/lib/hours';
import { deriveSuffix } from '../src/lib/strip';
import { fillTemplate, segmentsToText, sayProcedure } from '../src/lib/slots';
import { buildIndex, search } from '../src/lib/search';
import { planDeparture } from '../src/lib/departure';
import { EMPTY_FLIGHT } from '../src/lib/flight';
import { crossCheck } from '../scripts/crosscheck-lib';
import { compare } from '../scripts/staleness-lib';

const ds = loadDataset('data');
const airport = (id: string) => ds.airports.find((a) => a.id === id)!;

describe('AIRAC', () => {
  it('matches the Reference Card stamp (AIRAC 2604 effective 16 Apr 2026)', () => {
    expect(airacFor(new Date('2026-04-16T12:00:00Z')).ident).toBe('2604');
    expect(airacFor(new Date('2026-04-15T12:00:00Z')).ident).toBe('2603');
  });
  it('matches the FAA d-TPP cycle in force on 22 Oct 2026', () => {
    expect(airacFor(new Date('2026-10-22T00:00:00Z')).ident).toBe('2610');
  });
  it('rolls over the year', () => {
    expect(airacFor(new Date('2026-01-22T12:00:00Z')).ident).toBe('2601');
    expect(airacFor(new Date('2026-01-21T12:00:00Z')).ident).toBe('2513');
  });
  it('flags a stale reference', () => {
    expect(isStaleAirac('2604', new Date('2026-10-22'))).toBe(true);
    expect(isStaleAirac('2610', new Date('2026-10-22'))).toBe(false);
  });
});

describe('tower hours (America/Chicago)', () => {
  // 2026-10-21 is a Wednesday; CDT = UTC-5.
  it('OLV 0700–2100', () => {
    expect(towerStatus(airport('OLV'), new Date('2026-10-21T12:30:00Z'))).toBe('open'); // 0730
    expect(towerStatus(airport('OLV'), new Date('2026-10-22T03:00:00Z'))).toBe('closed'); // 2200
  });
  it('NQA Tue–Fri 0530–0200 spans midnight; Sat–Sun closes 1900', () => {
    expect(towerStatus(airport('NQA'), new Date('2026-10-22T06:30:00Z'))).toBe('open'); // Thu 0130, from Wed's window
    expect(towerStatus(airport('NQA'), new Date('2026-10-22T07:30:00Z'))).toBe('closed'); // Thu 0230
    expect(towerStatus(airport('NQA'), new Date('2026-10-25T01:00:00Z'))).toBe('closed'); // Sat 2000
  });
  it('MEM is sourced 24/7; BNA hours are not transcribed', () => {
    expect(towerStatus(airport('MEM'), new Date())).toBe('h24');
    expect(towerStatus(airport('BNA'), new Date())).toBe('unknown');
  });
});

describe('equipment suffix (TBL 2-3-10)', () => {
  it('derives from ICAO Item 10', () => {
    expect(deriveSuffix('SDE3FGHIRWY/LB1', ds.strips)).toBe('L'); // RVSM + GNSS + Mode S
    expect(deriveSuffix('SDFGRY/S', ds.strips)).toBe('G'); // GNSS, no RVSM
    expect(deriveSuffix('SDFRY/C', ds.strips)).toBe('I'); // RNAV no GNSS
    expect(deriveSuffix('SD/C', ds.strips)).toBe('A'); // DME, Mode C
    expect(deriveSuffix('S/N', ds.strips)).toBe('X');
  });
  it('accepts a bare suffix', () => {
    expect(deriveSuffix('/L', ds.strips)).toBe('L');
    expect(deriveSuffix('q', ds.strips)).toBeUndefined();
  });
});

describe('scripts', () => {
  it('fills slots and leaves missing ones visible', () => {
    const segs = fillTemplate('{callsign}, RNAV to {fix}, runway {rwy}.', { callsign: 'FDX123', rwy: '36C' });
    expect(segmentsToText(segs)).toBe('FDX123, RNAV to {fix}, runway 36C.');
  });
  it('speaks procedure numbers', () => expect(sayProcedure('GOETZ7')).toBe('GOETZ SEVEN'));
});

describe('departure plan details', () => {
  it('runway 9/27 departures fly runway heading to the SID 9/27 fix', () => {
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'north', night: false }, { ...EMPTY_FLIGHT, sid: 'GOETZ7', runway: '27' });
    expect(plan.takeoff).toBe('runway-heading');
    expect(plan.fix?.name).toBe('DOUUG');
  });
  it('a prop on ELVIS WTREE in north flow gets 315 and Departure West', () => {
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'north', night: false }, { ...EMPTY_FLIGHT, engine: 'prop', sid: 'ELVIS4', transition: 'WTREE' });
    expect(plan.heading?.value).toBe('315');
    expect(plan.depFreq?.freq).toBe('124.650');
    expect(plan.initialAlt?.feet).toBe(3000);
  });
  it('a lower filed altitude wins', () => {
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'north', night: false }, { ...EMPTY_FLIGHT, sid: 'GOETZ7', filedAlt: '4000' });
    expect(plan.initialAlt).toMatchObject({ feet: 4000, filedLower: true });
  });
  it('BNA TIPPN off 20C: RNAV DIXII, heading 200 by gate', () => {
    const plan = planDeparture(ds, { airport: 'BNA', flow: 'south', night: false }, { ...EMPTY_FLIGHT, sid: 'TIPPN4' });
    expect(plan.runway).toBe('20C');
    expect(plan.fix?.name).toBe('DIXII');
    expect(plan.heading?.value).toBe('200');
    expect(plan.depFreq?.freq).toBe('118.400');
  });
  it('minor fields take the first entry of their departure-frequency order', () => {
    const plan = planDeparture(ds, { airport: 'OLV', flow: '', night: false }, EMPTY_FLIGHT);
    expect(plan.depFreq?.freq).toBe('126.050');
    expect(plan.initialAlt?.feet).toBe(2000);
  });
});

describe('search', () => {
  const index = buildIndex(ds);
  it('finds SIDs, fixes, frequencies and scratchpads', () => {
    expect(search(index, 'GOETZ')[0].label).toBe('GOETZ7');
    expect(search(index, 'JAAXX')[0].kind).toBe('Fix');
    expect(search(index, '124.150').some((h) => h.label === 'MEM_V_DEP')).toBe(true);
    expect(search(index, '36W')[0].kind).toBe('Scratchpad');
  });
});

describe('pipeline', () => {
  it('cross-check finds no conflict that a discrepancy does not already flag', () => {
    const fresh = crossCheck(ds).filter((f) => f.level === 'conflict' && !f.known);
    expect(fresh).toEqual([]);
  });
  it('staleness diff spots updated, new and removed files', () => {
    const local = [
      { id: 'a', title: 'A', site_id: '1', site_updated: '2026-01-01' },
      { id: 'b', title: 'B', site_id: '2', site_updated: '2026-01-01' },
    ];
    const remote = [
      { id: '1', name: 'A', type: 'SOP', updated_at: '2026-02-01T00:00:00Z' },
      { id: '3', name: 'C', type: 'LOA', updated_at: '2026-01-01T00:00:00Z' },
    ];
    const r = compare(remote, local);
    expect(r.updated).toHaveLength(1);
    expect(r.added).toHaveLength(1);
    expect(r.removed).toHaveLength(1);
  });
});
