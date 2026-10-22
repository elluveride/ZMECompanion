import { useApp } from '../state';
import { DS, airportById } from '../data';
import { sidsFor, isUnavailable, type DeparturePlan } from '../lib/departure';
import { EMPTY_FLIGHT, type Flight } from '../lib/flight';
import { Card } from './ui';

const EXAMPLE: Partial<Flight> = {
  callsign: 'FDX123',
  type: 'B763',
  equipment: 'SDE3FGHIRWY/LB1',
  wake: '',
  engine: 'jet',
  rules: 'IFR',
  dep: 'KMEM',
  dest: 'KATL',
  route: '',
  filedAlt: 'FL350',
  sid: 'GOETZ7',
  transition: 'DIYAB',
  squawk: '',
  runway: '',
};

/** The one flight the controller is working; every page reads from it. */
export function FlightPanel({ plan, compact }: { plan: DeparturePlan; compact?: boolean }) {
  const { view, flight: f, setFlight, resetFlight } = useApp();
  const airport = airportById(view.airport);
  const sids = sidsFor(DS, view.airport);
  const elvisSid = plan.sid && !plan.sid.rnav && plan.sid.base === 'ELVIS';
  const text = (k: keyof Flight, label: string, opts: { upper?: boolean; placeholder?: string; width?: string } = {}) => (
    <label className="field" style={opts.width ? { width: opts.width } : undefined}>
      <span>{label}</span>
      <input
        value={f[k] as string}
        placeholder={opts.placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setFlight({ [k]: opts.upper === false ? e.target.value : e.target.value.toUpperCase() } as Partial<Flight>)}
      />
    </label>
  );
  return (
    <Card
      title="Active flight"
      className="flight"
      actions={
        <span className="card-actions">
          <button type="button" className="btn small" onClick={() => setFlight({ ...EMPTY_FLIGHT, ...EXAMPLE, dep: airport?.icao ?? 'KMEM' })}>
            Example
          </button>
          <button type="button" className="btn small ghost" onClick={resetFlight}>
            Clear
          </button>
        </span>
      }
    >
      <div className="fields">
        {text('callsign', 'Callsign', { placeholder: 'FDX123', width: '7.5rem' })}
        {text('type', 'Type', { placeholder: 'B763', width: '5rem' })}
        <div className="field seg-field">
          <span>Class</span>
          <div className="seg">
            {(['jet', 'prop'] as const).map((e) => (
              <button key={e} type="button" className={f.engine === e ? 'on' : ''} onClick={() => setFlight({ engine: e })}>
                {e === 'jet' ? 'Jet' : 'Prop'}
              </button>
            ))}
          </div>
        </div>
        <div className="field seg-field">
          <span>Rules</span>
          <div className="seg">
            {(['IFR', 'VFR'] as const).map((r) => (
              <button key={r} type="button" className={f.rules === r ? 'on' : ''} onClick={() => setFlight({ rules: r })}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {text('dest', 'Dest', { placeholder: 'KATL', width: '5rem' })}
        <label className="field">
          <span>SID</span>
          <select value={plan.sid?.name ?? (f.sid ? '?' : '')} onChange={(e) => setFlight({ sid: e.target.value, transition: '' })}>
            <option value="">— none —</option>
            {f.sid && !plan.sid && <option value="?">{f.sid} (unknown)</option>}
            {sids.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
                {isUnavailable(s, view.night) ? ' · night only' : ''}
                {s.rnav ? '' : ' · non-RNAV'}
              </option>
            ))}
          </select>
        </label>
        {elvisSid ? (
          <label className="field">
            <span>Transition</span>
            <select value={f.transition} onChange={(e) => setFlight({ transition: e.target.value })}>
              <option value="">—</option>
              {DS.elvis.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name} ({e.direction}){e.availability === 'night' ? ' · night' : e.availability === 'coord' ? ' · coord' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          text('transition', 'Transition', { placeholder: plan.sid?.transition ?? '', width: '6.5rem' })
        )}
        {text('filedAlt', 'Filed alt', { placeholder: 'FL350', width: '5.5rem' })}
        {text('squawk', 'Squawk', { placeholder: '4521', width: '4.5rem' })}
        <label className="field">
          <span>Runway</span>
          <select value={f.runway} onChange={(e) => setFlight({ runway: e.target.value })}>
            <option value="">auto{plan.runway && !f.runway ? ` (${plan.runway})` : ''}</option>
            {airport?.runways.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {!compact && (
          <>
            {text('equipment', 'Equipment', { placeholder: 'SDE3FGHIRWY/LB1 or L', width: '10rem' })}
            {text('route', 'Route', { placeholder: 'as filed', width: '12rem' })}
          </>
        )}
      </div>
      {plan.issues.length > 0 && (
        <ul className="issues">
          {plan.issues.map((i) => (
            <li key={i.text}>⚠ {i.text}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
