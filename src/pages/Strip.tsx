import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { DS, airportById } from '../data';
import { pdcDecision } from '../lib/pdc';
import { deriveSuffix, stripValues } from '../lib/strip';
import { Card, useCopy, copyText } from '../components/ui';
import { SourceTag } from '../components/Source';
import { FlightPanel } from '../components/FlightPanel';
import { PageHead } from '../components/Shell';
import { usePlan } from './common';

type Kind = 'departure' | 'arrival' | 'overflight';
const SMALL = new Set(['2', '2A', '8A', '8B', '9A', '9B', '9C']);

export function StripPage() {
  const { view, flight, setFlight, extras, setExtras } = useApp();
  const { plan } = usePlan();
  const [kind, setKind] = useState<Kind>('departure');
  const [target, setTarget] = useState('13');
  const [copied, copy] = useCopy();
  const layout = DS.strips.layouts.find((l) => l.kind === kind)!;
  const airport = airportById(view.airport)!;

  const arrival = useMemo(() => {
    const star = DS.stars.find((s) => s.airport === view.airport && s.name.replace(/\d+$/, '') === extras.star.toUpperCase().replace(/\d+$/, ''));
    const arrive = DS.flows.find((f) => f.airport === view.airport && f.id === view.flow)?.arrive ?? [];
    const runway = extras.arrRunway || star?.runways.find((r) => arrive.includes(r)) || star?.runways[0];
    const pad = runway ? DS.approach.scratchpads.find((s) => s.runway === runway) : undefined;
    return { star, runway, scratchpad: view.airport === 'MEM' && pad ? (extras.approach === 'visual' ? pad.visual : pad.instrument) : undefined };
  }, [extras, view]);

  const pdc = kind === 'departure' ? pdcDecision(flight, airport.pdc) : undefined;
  const values = stripValues(DS, flight, plan, pdc, extras, arrival);
  const boxValue = (box: string, field?: string) => extras.box[`${kind}:${box}`] ?? (field ? (values[field] ?? '') : '');
  const suffix = deriveSuffix(flight.equipment, DS.strips);
  const suffixRow = DS.strips.equipment_suffixes.rows.find((r) => r.suffix === suffix);

  const boxes = [
    ...layout.boxes,
    ...DS.strips.box_10_18_defaults.rows.map((r) => ({
      box: r.box,
      faa: 'Facility directive',
      fill: r.use,
      field: kind === 'departure' ? r.field : undefined,
    })),
  ];
  const allText = boxes
    .map((b) => [b.box, boxValue(b.box, b.field)] as const)
    .filter(([, v]) => v)
    .map(([b, v]) => `${b}\t${v}`)
    .join('\n');

  const box = (id: string) => {
    const b = boxes.find((x) => x.box === id);
    if (!b) return <div key={id} className="sbox" />;
    const v = boxValue(b.box, b.field);
    return (
      <button
        key={id}
        type="button"
        className={`sbox ${SMALL.has(id) ? 'tiny' : ''} ${copied === id ? 'copied' : ''} ${target === id ? 'target' : ''}`}
        title={`Box ${id}: ${b.faa}\n${b.fill}\n(click to copy)`}
        onClick={() => v && copy(id, v)}
        data-box={id}
      >
        <span className="bn">{id}</span>
        <span className="bv">{copied === id ? 'copied' : v}</span>
      </button>
    );
  };

  const insert = (code: string) => {
    const key = `${kind}:${target}`;
    const cur = extras.box[key] ?? '';
    setExtras({ box: { ...extras.box, [key]: cur ? `${cur} ${code}` : code } });
  };

  const field = (k: 'count' | 'star' | 'prevFix' | 'coordFix' | 'eta' | 'ovfRoute', label: string, placeholder = '') => (
    <label className="field">
      <span>{label}</span>
      <input value={extras[k]} placeholder={placeholder} onChange={(e) => setExtras({ [k]: e.target.value.toUpperCase() })} />
    </label>
  );

  return (
    <>
      <PageHead title="Strip filler" sub={<span className="muted">FAA JO 7110.65 2-3-4 layout, box for box — copy each box into vStrips</span>} />
      <div className="tabs" role="tablist">
        {(['departure', 'arrival', 'overflight'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div className="cols">
        <FlightPanel plan={plan} />
        <Card title="Strip inputs" src={layout.src}>
          <div className="fields">
            {field('count', 'Count', '1')}
            <label className="field">
              <span>Wake cat.</span>
              <input value={flight.wake} onChange={(e) => setFlight({ wake: e.target.value.toUpperCase() })} placeholder="CWT" />
            </label>
            {kind === 'departure' && (
              <>
                <label className="field">
                  <span>ETD (Z)</span>
                  <input value={flight.etd} placeholder="P1430" onChange={(e) => setFlight({ etd: e.target.value.toUpperCase() })} />
                </label>
                <label className="field">
                  <span>CID</span>
                  <input value={flight.cid} placeholder="123" onChange={(e) => setFlight({ cid: e.target.value.toUpperCase() })} />
                </label>
              </>
            )}
            {kind === 'arrival' && (
              <>
                <label className="field">
                  <span>STAR</span>
                  <select
                    value={arrival.star?.name ?? ''}
                    onChange={(e) => setExtras({ star: e.target.value, coordFix: extras.coordFix || e.target.value.replace(/\d+$/, '') })}
                  >
                    <option value="">—</option>
                    {DS.stars
                      .filter((s) => s.airport === view.airport)
                      .map((s) => (
                        <option key={s.name}>{s.name}</option>
                      ))}
                  </select>
                </label>
                {field('prevFix', 'Prev fix')}
                {field('coordFix', 'Coord fix', 'BRBBQ')}
                {field('eta', 'ETA (Z)', '1432')}
                <label className="field">
                  <span>Approach</span>
                  <select value={extras.approach} onChange={(e) => setExtras({ approach: e.target.value as 'instrument' | 'visual' })}>
                    <option value="instrument">Instrument</option>
                    <option value="visual">Visual</option>
                  </select>
                </label>
              </>
            )}
            {kind === 'overflight' && (
              <>
                {field('coordFix', 'Coord fix')}
                {field('eta', 'ETA (Z)')}
                {field('ovfRoute', 'Route through')}
              </>
            )}
          </div>
          <p className="small">
            Box 3 suffix:{' '}
            {suffix ? <b className="mono">/{suffix}</b> : <span className="muted">enter equipment as a FAA suffix (L) or ICAO Item 10 (SDE3FGHIRWY/LB1)</span>}
            {suffixRow && <span className="muted"> — {suffixRow.text}</span>} <SourceTag src={DS.strips.equipment_suffixes.src} />
          </p>
          <p className="muted small">Wake category isn't derived: the type → CWT category list isn't in the ZME files. Enter it per your CWT card.</p>
        </Card>
        <Card
          title={`${kind[0].toUpperCase() + kind.slice(1)} strip · ${layout.table}`}
          className="wide"
          actions={
            <button type="button" className="btn small" onClick={() => void copyText(allText)}>
              Copy all
            </button>
          }
        >
          <div className="strip-wrap">
            <div className="strip" data-kind={kind}>
              <div className="col c1">
                {box('1')}
                <div className="pair">
                  {box('2')}
                  {box('2A')}
                </div>
                {box('3')}
                {box('4')}
              </div>
              <div className="col c2">
                {box('5')}
                {box('6')}
                {box('7')}
              </div>
              <div className="col c3">
                {box('8')}
                {box('8A')}
                {box('8B')}
              </div>
              <div className="col c4">
                {box('9')}
                <div className="trio">
                  {box('9A')}
                  {box('9B')}
                  {box('9C')}
                </div>
              </div>
              <div className="col c5">{['10', '11', '12', '13', '14', '15', '16', '17', '18'].map(box)}</div>
            </div>
          </div>
          <p className="muted small">
            Click a box to copy it. “Copy all” gives box-numbered lines; vStrips' own field order is unconfirmed (open question Q3).
          </p>
          <details className="boxhelp">
            <summary>What goes in each box</summary>
            <table className="grid compact">
              <tbody>
                {boxes.map((b) => (
                  <tr key={b.box}>
                    <td className="mono">{b.box}</td>
                    <td className="small">{b.faa}</td>
                    <td className="small muted">{b.fill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
        <Card title="Boxes 10–18 & annotations" src={DS.strips.box_10_18_defaults.src}>
          <p className="muted small">7110.65 leaves 10–18 to a facility directive. No ZME strip-marking directive was found, so these are editable defaults.</p>
          <div className="fields">
            <label className="field">
              <span>Insert into box</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {['9', '9A', '9B', '9C', '10', '11', '12', '13', '14', '15', '16', '17', '18'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="field grow">
              <span>Box {target} text</span>
              <input
                value={extras.box[`${kind}:${target}`] ?? ''}
                placeholder={boxValue(target, boxes.find((b) => b.box === target)?.field)}
                onChange={(e) => setExtras({ box: { ...extras.box, [`${kind}:${target}`]: e.target.value } })}
              />
            </label>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => setExtras({ box: Object.fromEntries(Object.entries(extras.box).filter(([k]) => !k.startsWith(`${kind}:`))) })}
            >
              Reset boxes
            </button>
          </div>
          {DS.strips.annotations.map((t) => (
            <div key={t.table} className="palette">
              <div className="small">
                {t.table} <SourceTag src={t.src} />
              </div>
              {t.rows.map((r) => (
                <button key={r.code} type="button" className="code" title={r.meaning} onClick={() => insert(r.code)}>
                  {r.code}
                </button>
              ))}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
