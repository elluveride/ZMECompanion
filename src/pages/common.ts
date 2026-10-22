import { useMemo } from 'react';
import type { Position, Role, Src } from '../../schema/schema';
import { DS, airportById } from '../data';
import { useApp } from '../state';
import { planDeparture, type DeparturePlan } from '../lib/departure';
import { slotValues, type SlotValues } from '../lib/slots';
import { rulesFor } from '../components/blocks';

export function usePlan(): { plan: DeparturePlan; values: SlotValues } {
  const { view, flight } = useApp();
  return useMemo(() => {
    const airport = airportById(view.airport);
    const f = { ...flight, dep: flight.dep || airport?.icao || '' };
    const plan = planDeparture(DS, view, f);
    return { plan, values: slotValues(DS, view.airport, f, plan) };
  }, [view, flight]);
}

export const positionsAt = (facility: string, ...roles: Position['role'][]) => DS.positions.filter((p) => p.facility === facility && roles.includes(p.role));

export const primaryAt = (facility: string, role: Position['role']) => positionsAt(facility, role).find((p) => p.primary) ?? positionsAt(facility, role)[0];

/** Sources a page renders, for its Docs tab. */
export function pageSrcs(role: Role, airport: string, more: (Src[] | undefined)[] = []): Src[] {
  const out: Src[] = [];
  for (const r of [...rulesFor('ALL', airport), ...rulesFor(role, airport)]) out.push(...r.src);
  for (const s of DS.scripts) if (s.role === role && (!s.airports || s.airports.includes(airport))) out.push(...(s.src ?? []));
  for (const m of more) if (m) out.push(...m);
  return out;
}
