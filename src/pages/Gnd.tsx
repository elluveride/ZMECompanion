import { useApp } from '../state';
import { DS, airportById } from '../data';
import { sidsFor } from '../lib/departure';
import { Card, KvTable, Empty, type KvRow } from '../components/ui';
import { SourceTag, FlagBadge, flagFor } from '../components/Source';
import { Callouts, rulesFor, ScriptsTab, DocsTab, ChartsCard, PositionTable, ProceduresCard, FactsCard } from '../components/blocks';
import { FlightPanel } from '../components/FlightPanel';
import { FreqStrip, Tabs, PageHead } from '../components/Shell';
import { usePlan, positionsAt, primaryAt, pageSrcs } from './common';

const DIR_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' } as const;

function TaxiTable({ airport }: { airport: string }) {
  const { view } = useApp();
  const { plan } = usePlan();
  const rows = DS.taxi.filter((t) => t.airport === airport);
  if (!rows.length) return <Empty>No taxi-by-direction table for this airport.</Empty>;
  return (
    <table className="grid taxi">
      <thead>
        <tr>
          <th>Direction</th>
          <th className={view.flow === 'north' ? 'hot' : ''}>North flow</th>
          <th className={view.flow === 'south' ? 'hot' : ''}>South flow</th>
          <th>As printed</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.direction} className={plan.direction === t.direction ? 'hot' : undefined}>
            <th scope="row">{DIR_NAME[t.direction]}</th>
            <td className={`mono ${view.flow === 'north' ? 'hot' : ''}`}>{t.north.join(', ')}</td>
            <td className={`mono ${view.flow === 'south' ? 'hot' : ''}`}>
              {t.south.join(', ')} <FlagBadge id={flagFor({ flags: t.flags }, 'south')} />
            </td>
            <td className="mono muted small">{t.printed}</td>
            <td className="src-cell">
              <SourceTag src={t.src} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TaxiCard() {
  const { plan } = usePlan();
  const rows: KvRow[] = [];
  if (plan.sid?.gate || plan.elvis)
    rows.push({
      label: 'Direction of flight',
      value: (
        <>
          {DIR_NAME[plan.direction!]} <span className="muted small">(ELVIS gate {plan.sid?.gate ?? plan.elvis?.name})</span>
        </>
      ),
      src: plan.sid?.gate ? [{ doc: 'mem-departure-reference' }] : plan.elvis?.src,
    });
  if (plan.taxiRunways.length)
    rows.push({
      label: 'Runways for that direction',
      value: <span className="mono">{plan.taxiRunways.join(', ')}</span>,
      src: [{ doc: 'kmem-atct-sop', sec: '3-1-1' }],
    });
  if (plan.runway)
    rows.push({
      label: 'Taxi to',
      value: (
        <>
          <span className="mono big-val">{plan.runway}</span> <span className="muted small">{plan.runwayReason}</span>
        </>
      ),
    });
  return <Card title="Taxi">{rows.length ? <KvTable rows={rows} /> : <Empty>Pick a SID on the active flight to get its runway.</Empty>}</Card>;
}

function PreferredRunways({ airport }: { airport: string }) {
  const sids = sidsFor(DS, airport).filter((s) => s.preferred);
  if (!sids.length) return null;
  return (
    <Card title="Preferred runway when busy, by SID" src={{ doc: airport === 'MEM' ? 'mem-departure-reference' : 'bna-rnav-departure-reference' }}>
      <table className="grid compact">
        <thead>
          <tr>
            <th>SID</th>
            <th>Gate</th>
            <th>North</th>
            <th>South</th>
          </tr>
        </thead>
        <tbody>
          {sids.map((s) => (
            <tr key={s.name}>
              <td className="mono">{s.name}</td>
              <td className="mono small">{s.gate ?? s.side}</td>
              <td className="mono">{s.preferred?.north}</td>
              <td className="mono">{s.preferred?.south}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function GndPage() {
  const { view } = useApp();
  const { plan, values } = usePlan();
  const a = airportById(view.airport)!;
  const gnds = positionsAt(a.id, 'GND');
  const twr = primaryAt(a.id, 'TWR');
  const rules = [...rulesFor('GND', a.id), ...rulesFor('ALL', a.id)];
  const calm = DS.flows.find((f) => f.airport === a.id && f.id === a.calm_flow);
  const facts: KvRow[] = [];
  if (calm) facts.push({ label: 'Calm-wind flow', value: calm.name, src: calm.src });
  const flow = plan.flow;
  if (flow)
    facts.push({
      label: `${flow.name} flow`,
      value: (
        <>
          Depart <span className="mono">{flow.depart.join(', ')}</span> · Arrive <span className="mono">{flow.arrive.join(', ')}</span>
        </>
      ),
      src: flow.src,
      flag: flow.flag,
    });
  return (
    <>
      <FreqStrip
        mine={gnds.map((g) => ({ label: g.name, position: g }))}
        next={twr ? [{ label: twr.name === 'Local' ? 'Tower' : `Tower (${twr.name})`, position: twr }] : []}
      />
      <PageHead title="Ground" />
      <Tabs />
      {view.tab === 'cheat' && (
        <div className="cols">
          <FlightPanel plan={plan} compact />
          <TaxiCard />
          <Card title="Positions">
            <PositionTable positions={gnds} />
            {facts.length > 0 && <KvTable rows={facts} />}
          </Card>
          {DS.taxi.some((t) => t.airport === a.id) && (
            <Card title="Taxi to the runway for the direction of flight (high volume)" className="wide" src={{ doc: 'kmem-atct-sop', sec: '3-1-1b' }}>
              <TaxiTable airport={a.id} />
              <p className="muted small">
                The SOP lists runway pairs (e.g. “36L/18R”); the app splits them by the selected flow. Direction comes from each SID's ELVIS gate letter.
              </p>
            </Card>
          )}
          <ProceduresCard airport={a.id} role="GND" />
          <Callouts rules={rules} />
        </div>
      )}
      {view.tab === 'scripts' && (
        <ScriptsTab role="GND" airport={a.id} values={values}>
          <FlightPanel plan={plan} compact />
        </ScriptsTab>
      )}
      {view.tab === 'ref' && (
        <div className="cols">
          <ChartsCard
            airport={a.id}
            extra={
              a.id === 'MEM' ? (
                <p>
                  ZME's <SourceTag src={{ doc: 'fedex-ramp' }} /> document covers the FedEx ramp. Hot spots are marked on the airport diagram.
                </p>
              ) : undefined
            }
          />
          <PreferredRunways airport={a.id} />
          <FactsCard title={`${a.icao} facts`} airport={a.id} />
        </div>
      )}
      {view.tab === 'docs' && (
        <DocsTab
          srcs={pageSrcs('GND', a.id, [...gnds.map((g) => g.src), ...DS.taxi.filter((t) => t.airport === a.id).map((t) => t.src)])}
          extraDocs={a.id === 'MEM' ? ['fedex-ramp'] : []}
        />
      )}
    </>
  );
}
