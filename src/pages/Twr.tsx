import { useApp } from '../state';
import { DS, airportById } from '../data';
import { headingValue } from '../lib/departure';
import { towerStatus } from '../lib/hours';
import { Card, KvTable, Empty, Pill, Freq, type KvRow } from '../components/ui';
import { SourceTag, FlagBadge } from '../components/Source';
import { Callouts, rulesFor, ScriptsTab, DocsTab, ChartsCard, PositionTable, ProceduresCard, FactsCard } from '../components/blocks';
import { FlightPanel } from '../components/FlightPanel';
import { FreqStrip, Tabs, PageHead, type StripEntry } from '../components/Shell';
import { usePlan, positionsAt, primaryAt, pageSrcs } from './common';

export function HeadingTable({ airport, flow }: { airport: string; flow?: string }) {
  const { plan } = usePlan();
  const rules = DS.headings.filter((h) => h.airport === airport && (!flow || !h.flow || h.flow === flow));
  if (!rules.length) return <Empty>No heading table transcribed for this airport.</Empty>;
  return (
    <div className="scroll">
      <table className="grid headings">
        <thead>
          <tr>
            {!flow && <th>Flow</th>}
            {rules.some((r) => r.runways) && <th>Runways</th>}
            <th>Group</th>
            <th>Heading</th>
            <th>SIDs / ELVIS transitions</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={i} className={plan.heading?.rule === r ? 'hot' : undefined}>
              {!flow && <td>{r.flow ?? '—'}</td>}
              {rules.some((x) => x.runways) && <td className="mono small">{r.runways?.join(', ') ?? 'all'}</td>}
              <td>
                {r.aircraft === 'any' ? '' : r.aircraft === 'jet' ? 'Jets' : 'Props'} {r.side && `${r.side} `}
                {/props$/i.test(r.group) ? null : /^[A-Z]{5}$/.test(r.group) ? (
                  <span className="mono">via {r.group}</span>
                ) : (
                  <span className="muted">{r.group}</span>
                )}
              </td>
              <td className="mono big-val">{headingValue(r)}</td>
              <td className="small">
                {[r.sids.join(', '), r.elvis.join(', ')].filter(Boolean).join(' · ')}
                {r.note && <div className="muted">{r.note}</div>}
              </td>
              <td className="src-cell">
                <SourceTag src={r.src} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunwayConfig({ airport }: { airport: string }) {
  const { view } = useApp();
  const flows = DS.flows.filter((f) => f.airport === airport);
  if (!flows.length) return null;
  return (
    <Card title="Runway configuration">
      <table className="grid">
        <thead>
          <tr>
            <th>Flow</th>
            <th>Depart</th>
            <th>Arrive</th>
            <th>Optional</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {flows.map((f) => (
            <tr key={f.id} className={view.flow === f.id ? 'hot' : undefined}>
              <th scope="row">
                {f.name}
                {airportById(airport)?.calm_flow === f.id && <span className="muted small"> (calm)</span>}
              </th>
              <td className="mono">{f.depart.join(', ')}</td>
              <td className="mono">{f.arrive.join(', ')}</td>
              <td className="mono">{f.optional.join(', ')}</td>
              <td className="src-cell">
                <FlagBadge id={f.flag} />
                <SourceTag src={f.src} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {flows
        .filter((f) => f.id === view.flow)
        .flatMap((f) => f.notes)
        .map((n) => (
          <p key={n} className="muted small">
            {n}
          </p>
        ))}
    </Card>
  );
}

function TakeoffCard() {
  const { plan, values } = usePlan();
  const rows: KvRow[] = [];
  if (plan.runway) rows.push({ label: 'Runway', value: <span className="mono big-val">{plan.runway}</span> });
  if (plan.takeoff === 'rnav' && plan.fix)
    rows.push({
      label: 'Takeoff clearance',
      value: (
        <span className="phrase">
          “{values.callsign ?? '{callsign}'}, RNAV to <b>{plan.fix.name}</b>, runway {plan.runway}, cleared for takeoff.”
        </span>
      ),
      src: plan.sid?.src,
      flag: plan.fix.flag,
    });
  if (plan.takeoff === 'runway-heading') rows.push({ label: 'Takeoff clearance', value: <>{plan.fix?.note ?? 'Runway heading'}</>, src: plan.sid?.src });
  if (plan.heading)
    rows.push({
      label: plan.takeoff === 'rnav' ? 'If it gets a heading' : 'Heading',
      value: (
        <>
          <span className="mono big-val">{plan.heading.value}</span> <span className="muted small">{plan.heading.rule.group}</span>
        </>
      ),
      src: plan.heading.rule.src,
    });
  if (plan.depFreq)
    rows.push({
      label: 'Then to',
      value: (
        <>
          {plan.depFreq.position?.radio ?? plan.depFreq.label} <Freq freq={plan.depFreq.freq} />
        </>
      ),
      src: plan.depFreq.src,
    });
  return <Card title="Takeoff">{rows.length ? <KvTable rows={rows} /> : <Empty>Pick a SID on the active flight to get the takeoff clearance.</Empty>}</Card>;
}

export function TowerStatusPill({ airport }: { airport: string }) {
  const a = airportById(airport);
  if (!a) return null;
  const s = towerStatus(a, new Date());
  const map = {
    open: ['Tower open', 'ok'],
    closed: ['Tower closed', 'bad'],
    h24: ['24/7', 'ok'],
    uncontrolled: ['Uncontrolled', 'info'],
    unknown: ['Hours not transcribed', 'info'],
  } as const;
  return <Pill tone={map[s][1]}>{map[s][0]}</Pill>;
}

export function TwrPage() {
  const { view } = useApp();
  const { plan, values } = usePlan();
  const a = airportById(view.airport)!;
  const twrs = positionsAt(a.id, 'TWR');
  const rules = [...rulesFor('TWR', a.id), ...rulesFor('ALL', a.id)];
  const next: StripEntry[] = [];
  if (plan.depFreq) next.push({ label: plan.depFreq.position?.name ?? plan.depFreq.label, freq: plan.depFreq.freq, position: plan.depFreq.position });
  else for (const p of positionsAt(a.tracon, 'DEP')) next.push({ label: p.name, position: p });
  const primary = primaryAt(a.id, 'TWR');
  return (
    <>
      <FreqStrip mine={twrs.map((t) => ({ label: t.name, position: t }))} next={next} />
      <PageHead title="Tower" sub={<TowerStatusPill airport={a.id} />} />
      <Tabs />
      {view.tab === 'cheat' && (
        <div className="cols">
          <FlightPanel plan={plan} compact />
          <TakeoffCard />
          <Card title="Local positions" src={primary?.src}>
            <PositionTable positions={twrs} />
          </Card>
          <RunwayConfig airport={a.id} />
          {DS.headings.some((h) => h.airport === a.id) && (
            <Card title={`Departure headings${plan.flow ? ` · ${plan.flow.name} flow` : ''}`} className="wide">
              <HeadingTable airport={a.id} flow={plan.flow?.id} />
            </Card>
          )}
          <FactsCard title={`${a.icao} airspace & pattern`} airport={a.id} />
          <ProceduresCard airport={a.id} role="TWR" />
          <Callouts rules={rules} />
        </div>
      )}
      {view.tab === 'scripts' && (
        <ScriptsTab role="TWR" airport={a.id} values={values}>
          <FlightPanel plan={plan} compact />
        </ScriptsTab>
      )}
      {view.tab === 'ref' && (
        <div className="cols">
          {DS.headings.some((h) => h.airport === a.id) && (
            <Card title="Departure headings — all flows" className="wide">
              <HeadingTable airport={a.id} />
            </Card>
          )}
          <ApproachesCard airport={a.id} />
          <ChartsCard airport={a.id} />
          {a.id === 'MEM' && (
            <Card title="Guides">
              <p>
                <SourceTag src={{ doc: 'crda-guide' }} /> <SourceTag src={{ doc: 'adw-tool-guide' }} /> <SourceTag src={{ doc: 'cwt-table-cards' }} />
              </p>
            </Card>
          )}
        </div>
      )}
      {view.tab === 'docs' && (
        <DocsTab
          srcs={pageSrcs('TWR', a.id, [
            ...twrs.map((t) => t.src),
            ...DS.headings.filter((h) => h.airport === a.id).map((h) => h.src),
            ...DS.flows.filter((f) => f.airport === a.id).map((f) => f.src),
          ])}
          extraDocs={a.id === 'MEM' ? ['crda-guide', 'adw-tool-guide', 'cwt-table-cards'] : []}
        />
      )}
    </>
  );
}

export function ApproachesCard({ airport }: { airport: string }) {
  const a = airportById(airport);
  if (!a?.approaches) return null;
  return (
    <Card title="Approaches — IAF, altitude, localizer" src={a.approaches.src}>
      <table className="grid compact">
        <thead>
          <tr>
            <th>Rwy</th>
            <th>IAF</th>
            <th>MSL</th>
            <th>Freq / type</th>
          </tr>
        </thead>
        <tbody>
          {a.approaches.rows.map((r, i) => (
            <tr key={i}>
              <td className="mono">{r.rwy}</td>
              <td className="mono">{r.iaf}</td>
              <td className="mono">{r.alt?.toLocaleString('en-US') ?? '—'}</td>
              <td className="mono small">
                {[r.freq, r.nav].filter(Boolean).join(' ')}
                {r.cat23 && <span title="CAT II/III"> ‡</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {a.approaches.rows.some((r) => r.cat23) && <p className="muted small">‡ CAT II/III</p>}
    </Card>
  );
}
