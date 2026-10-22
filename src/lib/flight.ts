/** The flight the controller is working right now — shared by DEL, GND, TWR, Scripts and Strips. */
export type Flight = {
  callsign: string;
  type: string;
  /** ICAO Item 10 string "SDE3FGHIRWY/LB1", or a bare FAA suffix like "L". */
  equipment: string;
  wake: string;
  engine: 'jet' | 'prop';
  rules: 'IFR' | 'VFR';
  dep: string;
  dest: string;
  route: string;
  filedAlt: string;
  /** SID name as published (GOETZ7, ELVIS4) or '' for none. */
  sid: string;
  /** ELVIS transition (NTWOO…) or the SID's named transition. */
  transition: string;
  squawk: string;
  cid: string;
  etd: string;
  /** Overrides the computed departure runway. */
  runway: string;
  // PDC checker answers that can't be derived from the flight plan.
  localArea: boolean;
  military: boolean;
  pilotRequestedPdc: boolean;
  needsAmendment: boolean;
  voiceRequest: boolean;
};

export const EMPTY_FLIGHT: Flight = {
  callsign: '',
  type: '',
  equipment: '',
  wake: '',
  engine: 'jet',
  rules: 'IFR',
  dep: '',
  dest: '',
  route: '',
  filedAlt: '',
  sid: '',
  transition: '',
  squawk: '',
  cid: '',
  etd: '',
  runway: '',
  localArea: false,
  military: false,
  pilotRequestedPdc: false,
  needsAmendment: false,
  voiceRequest: false,
};

/** "AAL, DAL, FDX…" — a three-letter identifier prefix (PDC Policy 2-1-2). */
export const isAirCarrier = (callsign: string) => /^[A-Z]{3}\d/.test(callsign.trim().toUpperCase());
