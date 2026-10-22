import type { Src } from '../../schema/schema';
import { isAirCarrier, type Flight } from './flight';

export type PdcResult = {
  result: 'PDC' | 'VOICE';
  reason: string;
  src: Src[];
  /** The three checker questions, answered. */
  steps: { q: string; a: string; decisive: boolean }[];
};

const S = (sec: string): Src => ({ doc: 'zme-pre-departure-clearance-policy', sec });

/** ZME PDC Policy decision: excluded? eligible? needs amendment? */
export function pdcDecision(f: Flight, airportIssuesPdc: boolean): PdcResult {
  const steps: PdcResult['steps'] = [];
  if (!airportIssuesPdc) {
    return { result: 'VOICE', reason: 'PDCs are issued only at MEM, BNA and LIT.', src: [S('3-1-1')], steps };
  }

  const excluded = f.rules === 'VFR' || f.localArea || f.military;
  steps.push({
    q: 'VFR, local-area, or USAF/USN/USA / fighter-attack?',
    a: excluded ? [f.rules === 'VFR' && 'VFR', f.localArea && 'local-area', f.military && 'military'].filter(Boolean).join(', ') : 'No',
    decisive: excluded,
  });
  if (excluded) return { result: 'VOICE', reason: 'Excluded from PDC.', src: [S('3-1-3')], steps };

  const carrier = isAirCarrier(f.callsign);
  const eligible = carrier || f.engine === 'jet' || f.pilotRequestedPdc;
  steps.push({
    q: 'Air carrier, turbojet, or pilot requested PDC?',
    a: eligible ? [carrier && 'air carrier', f.engine === 'jet' && 'turbojet', f.pilotRequestedPdc && 'pilot request'].filter(Boolean).join(', ') : 'No',
    decisive: !eligible,
  });
  if (!eligible) return { result: 'VOICE', reason: 'Not PDC-eligible.', src: [S('3-1-2')], steps };

  if (f.voiceRequest) {
    steps.push({ q: 'Pilot asked for clearance on frequency?', a: 'Yes — may be treated as not PDC-capable', decisive: true });
    return { result: 'VOICE', reason: 'Requested clearance by voice.', src: [S('4-1-2')], steps };
  }

  steps.push({
    q: 'Does the route need an amendment? (A SID change alone is not one.)',
    a: f.needsAmendment ? 'Yes' : 'No',
    decisive: f.needsAmendment,
  });
  if (f.needsAmendment) return { result: 'VOICE', reason: 'Needs an amendment — clear by voice.', src: [S('4-1-1')], steps };

  return { result: 'PDC', reason: 'PDC-eligible: send it as soon as the plan is in vTDLS.', src: [S('3-1-2'), S('4-1-2')], steps };
}
