import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DS } from './data';
import { EMPTY_FLIGHT, type Flight } from './lib/flight';
import { EMPTY_EXTRAS, type StripExtras } from './lib/strip';

export const PAGES = ['del', 'gnd', 'twr', 'app', 'ctr', 'strip', 'library', 'issues'] as const;
export type Page = (typeof PAGES)[number];
export const TABS = ['cheat', 'scripts', 'ref', 'docs'] as const;
export type Tab = (typeof TABS)[number];

export type View = { page: Page; airport: string; flow: string; night: boolean; tab: Tab };

const STORE = 'zme-companion:v1';

type Stored = { view?: Partial<View>; flight?: Flight; extras?: StripExtras };

function readStore(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

function writeStore(s: Stored) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    // Private mode / blocked storage: the URL still carries the view.
  }
}

const defaultFlow = (airport: string) => {
  const a = DS.airports.find((x) => x.id === airport);
  const flows = DS.flows.filter((f) => f.airport === airport);
  return flows.find((f) => f.id === a?.calm_flow)?.id ?? flows[0]?.id ?? '';
};

const isAirport = (id: string | null): id is string => !!id && DS.airports.some((a) => a.id === id && a.group !== 'satellite');

/** Parse "#/del?apt=MEM&flow=north&night=1&tab=ref", falling back to the last stored view. */
export function parseHash(hash: string, fallback: Partial<View> = {}): View {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query);
  const page = (PAGES as readonly string[]).includes(path) ? (path as Page) : (fallback.page ?? 'del');
  const airport = isAirport(q.get('apt')) ? q.get('apt')! : isAirport(fallback.airport ?? null) ? fallback.airport! : 'MEM';
  const flows = DS.flows.filter((f) => f.airport === airport).map((f) => f.id);
  const wanted = q.get('flow') ?? (fallback.airport === airport ? fallback.flow : undefined);
  const flow = wanted && flows.includes(wanted) ? wanted : defaultFlow(airport);
  const night = q.has('night') ? q.get('night') === '1' : (fallback.night ?? false);
  const tab = (TABS as readonly string[]).includes(q.get('tab') ?? '') ? (q.get('tab') as Tab) : 'cheat';
  return { page, airport, flow, night, tab };
}

export function toHash(v: View): string {
  const q = new URLSearchParams({ apt: v.airport, flow: v.flow, night: v.night ? '1' : '0' });
  if (v.tab !== 'cheat') q.set('tab', v.tab);
  return `#/${v.page}?${q}`;
}

type Ctx = {
  view: View;
  setView: (patch: Partial<View>) => void;
  flight: Flight;
  setFlight: (patch: Partial<Flight>) => void;
  resetFlight: () => void;
  extras: StripExtras;
  setExtras: (patch: Partial<StripExtras>) => void;
};

const AppState = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(readStore, []);
  const [view, setViewState] = useState<View>(() => parseHash(location.hash, stored.view));
  const [flight, setFlightState] = useState<Flight>({ ...EMPTY_FLIGHT, ...stored.flight });
  const [extras, setExtrasState] = useState<StripExtras>({ ...EMPTY_EXTRAS, ...stored.extras });

  useEffect(() => {
    const onHash = () => setViewState((v) => parseHash(location.hash, v));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const h = toHash(view);
    if (location.hash !== h) history.replaceState(null, '', h);
    writeStore({ view, flight, extras });
  }, [view, flight, extras]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const setView = useCallback((patch: Partial<View>) => {
    const v = viewRef.current;
    const next = { ...v, ...patch };
    if (patch.airport && patch.airport !== v.airport && !patch.flow) next.flow = defaultFlow(patch.airport);
    if (patch.page && patch.page !== v.page && !patch.tab) next.tab = 'cheat';
    if (patch.page && patch.page !== v.page) history.pushState(null, '', toHash(next));
    setViewState(next);
  }, []);
  const setFlight = useCallback((patch: Partial<Flight>) => setFlightState((f) => ({ ...f, ...patch })), []);
  const resetFlight = useCallback(() => setFlightState({ ...EMPTY_FLIGHT }), []);
  const setExtras = useCallback((patch: Partial<StripExtras>) => setExtrasState((x) => ({ ...x, ...patch })), []);

  const value = useMemo(
    () => ({ view, setView, flight, setFlight, resetFlight, extras, setExtras }),
    [view, setView, flight, setFlight, resetFlight, extras, setExtras],
  );
  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppState);
  if (!ctx) throw new Error('useApp outside AppStateProvider');
  return ctx;
}
