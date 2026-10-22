import { useApp } from '../state';
import { airportById } from '../data';
import { pdcDecision } from '../lib/pdc';
import { isAirCarrier } from '../lib/flight';
import { Card } from './ui';
import { SourceTag } from './Source';

export function PdcChecker() {
  const { view, flight: f, setFlight } = useApp();
  const airport = airportById(view.airport);
  const r = pdcDecision(f, !!airport?.pdc);
  const box = (k: 'localArea' | 'military' | 'pilotRequestedPdc' | 'needsAmendment' | 'voiceRequest', label: string) => (
    <label className="check">
      <input type="checkbox" checked={f[k]} onChange={(e) => setFlight({ [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <Card title="PDC or voice?" src={{ doc: 'zme-pre-departure-clearance-policy' }} className="pdc">
      <div className={`verdict ${r.result === 'PDC' ? 'ok' : 'warn'}`} data-testid="pdc-verdict">
        <span className="big">{r.result}</span>
        <span>{r.reason}</span>
        <SourceTag src={r.src} />
      </div>
      {airport?.pdc ? (
        <ol className="pdc-q">
          <li>
            Excluded? <span className="muted">VFR ({f.rules === 'VFR' ? 'yes' : 'no'} — set in Active flight)</span>
            <div className="checks">
              {box('localArea', 'Local-area (route entirely inside the terminal area)')}
              {box('military', 'USAF/USN/USA or fighter/attack')}
            </div>
          </li>
          <li>
            Eligible?{' '}
            <span className="muted">
              air carrier: {isAirCarrier(f.callsign) ? 'yes' : 'no'} · turbojet: {f.engine === 'jet' ? 'yes' : 'no'}
            </span>
            <div className="checks">
              {box('pilotRequestedPdc', 'Pilot requested PDC')}
              {box('voiceRequest', 'Pilot asked for clearance on frequency')}
            </div>
          </li>
          <li>
            Needs an amendment? <span className="muted">A SID change alone is not one.</span>
            <div className="checks">{box('needsAmendment', 'Route needs an amendment')}</div>
          </li>
        </ol>
      ) : (
        <p className="muted">{airport?.icao} is not a PDC airport — clear by voice.</p>
      )}
      <p className="muted small">After a PDC, if an amendment is needed: “{f.callsign || '{callsign}'}, disregard PDC message” and clear by voice.</p>
    </Card>
  );
}
