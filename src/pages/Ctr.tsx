import { useState } from 'react';
import { useApp } from '../state';
import { DS } from '../data';
import { Card, Freq, Empty } from '../components/ui';
import { TowerStatusPill } from './Twr';
import { SourceTag, FlagBadge, flagFor } from '../components/Source';
import { Callouts, rulesFor, ScriptsTab, DocsTab } from '../components/blocks';
import { FreqStrip, Tabs, PageHead } from '../components/Shell';
import { usePlan, pageSrcs } from './common';

type Stratum = 'area' | 'lo' | 'hi' | 'uh';
const STRATA: { id: Stratum; label: string }[] = [
  { id: 'area', label: 'Area (preferred)' },
  { id: 'lo', label: 'LO' },
  { id: 'hi', label: 'HI' },
  { id: 'uh', label: 'UH' },
];
const sector = (id: string) => DS.enroute.sectors.find((s) => s.id === id)!;

function SplitPicker({
  stratum,
  ways,
  mine,
  onChange,
}: {
  stratum: Stratum;
  ways: number;
  mine: string;
  onChange: (p: { stratum?: Stratum; ways?: number; mine?: string }) => void;
}) {
  const options = DS.enroute.splits.filter((s) => s.stratum === stratum);
  const split = options.find((s) => s.ways === ways) ?? options[0];
  return (
    <Card title="How is ZME split?" className="wide" src={split.src}>
      <div className="picker">
        <div className="seg" role="group" aria-label="Stratum">
          {STRATA.map((s) => (
            <button
              key={s.id}
              type="button"
              className={stratum === s.id ? 'on' : ''}
              onClick={() => onChange({ stratum: s.id, ways: s.id === 'area' ? 1 : 2, mine: '' })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Ways">
          {options.map((s) => (
            <button key={s.ways} type="button" className={split.ways === s.ways ? 'on' : ''} onClick={() => onChange({ ways: s.ways, mine: '' })}>
              {s.ways === 1 ? 'Combined' : `${s.ways}-way`}
            </button>
          ))}
        </div>
      </div>
      {stratum !== 'area' && <p className="warn-text small">LO/HI/UH splits need senior staff, the EC, an event CIC, or their designee.</p>}
      <table className="grid">
        <thead>
          <tr>
            <th>Working?</th>
            <th>Position</th>
            <th>Callsign</th>
            <th>Freq</th>
            <th>Areas</th>
          </tr>
        </thead>
        <tbody>
          {split.positions.map((p) => {
            const s = sector(p.sector);
            const freq = p.freq ?? s.freq;
            return (
              <tr key={p.sector} className={mine === p.sector ? 'hot' : undefined}>
                <td>
                  <input
                    type="radio"
                    name="mine"
                    aria-label={`I'm working ${s.name}`}
                    checked={mine === p.sector}
                    onChange={() => onChange({ mine: p.sector })}
                  />
                </td>
                <td>
                  {s.name} {s.id}
                </td>
                <td className="mono">{s.callsign}</td>
                <td>
                  <Freq freq={freq} /> <FlagBadge id={p.flag ?? flagFor({ flags: s.flags }, 'freq')} />
                </td>
                <td className="mono">{p.areas?.join(', ') ?? 'all'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AitCards({ areas }: { areas?: number[] }) {
  const [filter, setFilter] = useState<number | null>(null);
  const active = filter ? [filter] : areas;
  const list = DS.ait.filter((a) => !active || a.areas.some((x) => active.includes(x)));
  return (
    <Card title={`AIT procedures${areas ? ` · areas ${areas.join(', ')}` : ''}`} className="wide" src={{ doc: 'zme-enroute-sop', sec: 'chapter 4' }}>
      {!areas && (
        <div className="seg small" role="group" aria-label="Area filter">
          <button type="button" className={filter === null ? 'on' : ''} onClick={() => setFilter(null)}>
            All areas
          </button>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className={filter === n ? 'on' : ''} onClick={() => setFilter(n)}>
              Area {n}
            </button>
          ))}
        </div>
      )}
      <div className="aits">
        {list.map((a) => (
          <article key={a.id} className="ait">
            <h3>
              {a.title} <FlagBadge id={a.flag} />
            </h3>
            <p className="muted small">
              Sectors {a.sectors.join(' → ')} · area {a.areas.join(', ')}
            </p>
            <ol>
              {a.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <SourceTag src={a.src} />
          </article>
        ))}
        {!list.length && <Empty>No AIT procedures for these areas.</Empty>}
      </div>
    </Card>
  );
}

function LoaTable() {
  return (
    <Card title="External LOAs — handoff restrictions" className="wide" src={{ doc: 'reference-card', sec: 'External LOAs' }}>
      <p className="muted small">Reference Card summary — the LOA wins when they differ.</p>
      <div className="scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Neighbour</th>
              <th>Destination</th>
              <th>Restriction</th>
            </tr>
          </thead>
          <tbody>
            {DS.enroute.neighbours.flatMap((n) =>
              DS.enroute.loa_rules
                .filter((r) => r.neighbour === n.id)
                .map((r, i) => (
                  <tr key={`${n.id}${i}`}>
                    {i === 0 && (
                      <td rowSpan={DS.enroute.loa_rules.filter((x) => x.neighbour === n.id).length} className="nb">
                        <b>{n.id}</b> {n.name}
                        <div>
                          <Freq freq={n.freq} />
                        </div>
                        <SourceTag src={{ doc: n.loa }} />
                      </td>
                    )}
                    <td className="mono">{r.destination}</td>
                    <td>{r.restriction}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InternalArrivals() {
  const rows = DS.enroute.arrival_restrictions;
  return (
    <Card title="Arrival crossing restrictions — internal" src={rows[0]?.src}>
      <table className="grid">
        <thead>
          <tr>
            <th>Dest</th>
            <th>Aircraft</th>
            <th>Restriction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="mono">{r.destination}</td>
              <td>{r.aircraft}</td>
              <td>{r.restriction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Top-down: everything below CTR that isn't staffed is yours. */
function CoveringPanel() {
  const { setView } = useApp();
  const towered = DS.airports.filter((a) => a.group !== 'satellite');
  return (
    <Card title="Covering top-down" src={{ doc: 'zme-general-operating-procedures', sec: '4-1-1' }}>
      <p className="muted small">Brief and relief rules apply to top-down coverage too. Open an airport's cards:</p>
      <table className="grid compact">
        <tbody>
          {towered.map((a) => {
            return (
              <tr key={a.id}>
                <td className="mono">{a.icao}</td>
                <td>
                  <TowerStatusPill airport={a.id} />
                </td>
                <td className="links">
                  {(['del', 'gnd', 'twr'] as const).map((p) => (
                    <button key={p} type="button" className="btn small ghost" onClick={() => setView({ page: p, airport: a.id })}>
                      {p.toUpperCase()}
                    </button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Minor-field releases with no TRACON default to Memphis Center 132.550 (Minor Field Reference, Table 3).</p>
    </Card>
  );
}

function SectorList() {
  return (
    <Card
      title="All sectors"
      className="wide"
      src={[
        { doc: 'zme-enroute-sop', sec: '3-2-2' },
        { doc: 'zme-enroute-sop', sec: '3-2-4' },
      ]}
    >
      <div className="three">
        {(['lo', 'hi', 'uh'] as const).map((st) => (
          <table key={st} className="grid compact">
            <caption>{st.toUpperCase()}</caption>
            <tbody>
              {DS.enroute.sectors
                .filter((s) => s.stratum === st)
                .map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.id}</td>
                    <td>{s.name}</td>
                    <td>
                      <Freq freq={s.freq} /> <FlagBadge id={flagFor({ flags: s.flags }, 'freq')} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ))}
      </div>
    </Card>
  );
}

export function CtrPage() {
  const { view } = useApp();
  const { values } = usePlan();
  const [split, setSplit] = useState<{ stratum: Stratum; ways: number; mine: string }>({ stratum: 'area', ways: 1, mine: '22' });
  const current = DS.enroute.splits.find((s) => s.stratum === split.stratum && s.ways === split.ways) ?? DS.enroute.splits[0];
  const minePos = current.positions.find((p) => p.sector === split.mine);
  const mine = minePos ? sector(minePos.sector) : sector('22');
  const rules = [...rulesFor('CTR', view.airport), ...rulesFor('ALL', view.airport)];
  return (
    <>
      <FreqStrip
        mine={[{ label: `${mine.name} ${mine.id}`, freq: minePos?.freq ?? mine.freq, note: mine.callsign }]}
        next={DS.enroute.neighbours.map((n) => ({ label: n.id, freq: n.freq }))}
      />
      <PageHead title="Center" sub={<span className="muted">Memphis Center · combined is Razorback 22 on 132.550</span>} />
      <Tabs />
      {view.tab === 'cheat' && (
        <div className="cols">
          <SplitPicker stratum={split.stratum} ways={current.ways} mine={split.mine} onChange={(p) => setSplit((s) => ({ ...s, ...p }))} />
          <AitCards areas={minePos?.areas} />
          <LoaTable />
          <InternalArrivals />
          <CoveringPanel />
          <Callouts rules={rules} />
        </div>
      )}
      {view.tab === 'scripts' && <ScriptsTab role="CTR" airport={view.airport} values={values} />}
      {view.tab === 'ref' && (
        <div className="cols">
          <SectorList />
          <Card title="All splits" className="wide" src={{ doc: 'zme-enroute-sop', sec: '3-2' }}>
            <table className="grid">
              <tbody>
                {DS.enroute.splits.map((s) => (
                  <tr key={s.label}>
                    <th scope="row">{s.label}</th>
                    <td className="small">
                      {s.positions.map((p) => {
                        const x = sector(p.sector);
                        return (
                          <span key={p.sector} className="kvchip">
                            {x.name} {x.id} · <span className="mono">{p.freq ?? x.freq}</span>
                            {p.areas && ` · areas ${p.areas.join(',')}`}
                          </span>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <AitCards />
          <Card title="VORs" src={DS.references.vors.src}>
            <table className="grid compact">
              <tbody>
                {DS.references.vors.rows.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td>{v.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      {view.tab === 'docs' && (
        <DocsTab
          srcs={pageSrcs('CTR', view.airport, [...DS.enroute.splits.map((s) => s.src), ...DS.ait.map((a) => a.src), ...DS.enroute.loa_rules.map((r) => r.src)])}
          extraDocs={DS.docs.filter((d) => d.category === 'loa').map((d) => d.id)}
        />
      )}
    </>
  );
}
