// The MVP spec's acceptance checks, run against the real data/ files.
import { describe, expect, it } from 'vitest';
import { loadDataset } from '../schema/build';
import { planDeparture, sidsFor, isUnavailable } from '../src/lib/departure';
import { pdcDecision } from '../src/lib/pdc';
import { EMPTY_FLIGHT, type Flight } from '../src/lib/flight';

const ds = loadDataset('data');
const fdx123: Flight = {
  ...EMPTY_FLIGHT,
  callsign: 'FDX123',
  type: 'B763',
  engine: 'jet',
  dep: 'KMEM',
  dest: 'KATL',
  sid: 'GOETZ7',
  transition: 'DIYAB',
  filedAlt: 'FL350',
};

describe('FDX123 KMEM→KATL on GOETZ7', () => {
  it('north flow: 5,000, initial fix JAAXX, Departure East 124.150, PDC', () => {
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'north', night: false }, fdx123);
    expect(plan.initialAlt?.feet).toBe(5000);
    expect(plan.fix?.name).toBe('JAAXX');
    expect(plan.depFreq?.label).toBe('Departure East');
    expect(plan.depFreq?.freq).toBe('124.150');
    expect(plan.takeoff).toBe('rnav');
    expect(pdcDecision(fdx123, plan.airport!.pdc).result).toBe('PDC');
  });

  it('south flow: RIBZZ, and heading 165 off 18C if it gets a heading', () => {
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'south', night: false }, fdx123);
    expect(plan.runway).toBe('18C');
    expect(plan.fix?.name).toBe('RIBZZ');
    expect(plan.heading?.value).toBe('165');
  });
});

describe('night-only SIDs', () => {
  const night = ['AUTMN6', 'BINKY6', 'GENEH7', 'GMBUD7', 'GRRIZ5', 'HOTRD5', 'NIKEI5', 'OLEMS6'];

  it('match the Reference Card asterisks exactly', () => {
    const flagged = sidsFor(ds, 'MEM')
      .filter((s) => s.availability === 'night')
      .map((s) => s.name);
    expect(flagged.sort()).toEqual(night.sort());
  });

  it('are unavailable with Night off and available with Night on', () => {
    const autmn = sidsFor(ds, 'MEM').find((s) => s.name === 'AUTMN6')!;
    expect(isUnavailable(autmn, false)).toBe(true);
    expect(isUnavailable(autmn, true)).toBe(false);
    const plan = planDeparture(ds, { airport: 'MEM', flow: 'north', night: false }, { ...fdx123, sid: 'AUTMN6' });
    expect(plan.issues.some((i) => i.text.includes('0200–0600'))).toBe(true);
  });
});

describe('PDC checker', () => {
  it('a C172 VFR departure gets VOICE', () => {
    const c172: Flight = { ...EMPTY_FLIGHT, callsign: 'N172SP', type: 'C172', engine: 'prop', rules: 'VFR' };
    expect(pdcDecision(c172, true).result).toBe('VOICE');
  });
  it('an IFR prop that is not an air carrier and did not ask gets VOICE', () => {
    expect(pdcDecision({ ...EMPTY_FLIGHT, callsign: 'N123AB', engine: 'prop' }, true).result).toBe('VOICE');
  });
  it('a SID change alone is not an amendment', () => {
    expect(pdcDecision({ ...fdx123, needsAmendment: false }, true).result).toBe('PDC');
    expect(pdcDecision({ ...fdx123, needsAmendment: true }, true).result).toBe('VOICE');
  });
  it('no PDC outside MEM/BNA/LIT', () => {
    expect(pdcDecision(fdx123, false).result).toBe('VOICE');
  });
});

describe('sources and discrepancies', () => {
  it('every record source resolves to a document with a URL (ZME files) or a named external doc', () => {
    for (const d of ds.docs) {
      if (d.category !== 'external') expect(d.url).toMatch(/^https:\/\/memphisartcc\.com\/files\/[0-9a-f-]{36}\/download$/);
    }
  });
  it('carries the seven spec discrepancies, all open', () => {
    const ids = ds.discrepancies.filter((d) => d.found === 'spec').map((d) => d.id);
    expect(ids).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
    expect(ds.discrepancies.every((d) => d.status === 'open')).toBe(true);
  });
});
