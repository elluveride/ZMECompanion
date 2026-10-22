import { useApp } from '../state';
import { DS, airportById } from '../data';
import { ft } from '../lib/format';
import { towerStatus } from '../lib/hours';
import { Card, Empty, Pill } from '../components/ui';
import { SourceTag, FlagBadge, flagFor } from '../components/Source';
import { Callouts, rulesFor, ScriptsTab, DocsTab, PositionTable, ProceduresCard, ChartLink, ChartsCard } from '../components/blocks';
import { FreqStrip, Tabs, PageHead, type StripEntry } from '../components/Shell';
import { usePlan, positionsAt, primaryAt, pageSrcs } from './common';
import { ApproachesCard } from './Twr';

function FeederTable() {
  const t = DS.approach.feeder_altitudes;
  return (
    <Card title={`Feeder → final handoff altitudes (${t.speed})`} src={t.src}>
      <table className="grid">
        <thead>
          <tr>
            <th>Traffic</th>
            <th>ARE</th>
            <th>ARW</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.traffic}>
              <td>
                {r.traffic}
                {r.note && <div className="muted small">{r.note}</div>}
              </td>
              <td className="mono big-val">{ft(r.are)}</td>
              <td className="mono big-val">{ft(r.arw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StarTable({ airport }: { airport: string }) {
  const { view } = useApp();
  const stars = DS.stars.filter((s) => s.airport === airport);
  if (!stars.length) return <Empty>No STARs transcribed for this airport.</Empty>;
  const flowRwys = new Set(DS.flows.find((f) => f.airport === airport && f.id === view.flow)?.arrive ?? []);
  const label = { rnav: 'RNAV', conventional: 'Non-RNAV', atc_assigned: 'ATC-assigned' } as const;
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>STAR</th>
          <th>Type</th>
          <th>Runway</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {stars.map((s) => (
          <tr key={s.name}>
            <td className="mono">
              <ChartLink airport={airport} stem={s.chart ?? s.name.replace(/\d+$/, '').toLowerCase()}>
                {s.name}
              </ChartLink>
              {s.alias && <span className="muted small"> ({s.alias})</span>} <FlagBadge id={flagFor({ flags: s.flags }, 'name')} />
            </td>
            <td className="small">{label[s.type]}</td>
            <td className="mono">
              {s.runways.length
                ? s.runways.map((r, i) => (
                    <span key={r} className={flowRwys.has(r) ? 'hot-text' : 'muted'}>
                      {i > 0 && '/'}
                      {r}
                    </span>
                  ))
                : '—'}
            </td>
            <td className="src-cell">
              <SourceTag src={s.src} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScratchpadTable() {
  const { view } = useApp();
  const arrive = new Set(DS.flows.find((f) => f.airport === 'MEM' && f.id === view.flow)?.arrive ?? []);
  return (
    <Card title="Approach scratchpads" src={{ doc: 'm03-tracon-sop', sec: '6-1-2' }}>
      <table className="grid compact">
        <thead>
          <tr>
            <th>Runway</th>
            <th>Visual</th>
            <th>Instrument</th>
          </tr>
        </thead>
        <tbody>
          {DS.approach.scratchpads.map((s) => (
            <tr key={s.runway} className={arrive.has(s.runway) ? 'hot' : undefined}>
              <td className="mono">{s.runway}</td>
              <td className="mono">{s.visual}</td>
              <td className="mono big-val">{s.instrument}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Secondary (Y+):{' '}
        {DS.approach.secondary_scratchpads.map((s) => (
          <span key={s.code} className="kvchip">
            <b className="mono">{s.code}</b> {s.meaning}
          </span>
        ))}
      </p>
    </Card>
  );
}

function SatelliteCard({ tracon }: { tracon: string }) {
  const sats = DS.airports.filter((a) => a.tracon === tracon && a.group !== 'major');
  if (!sats.length) return null;
  return (
    <Card title="Satellites" src={{ doc: 'm03-tracon-sop', sec: '3-1-1' }}>
      <table className="grid compact">
        <tbody>
          {sats.map((a) => (
            <tr key={a.id}>
              <td className="mono">{a.icao}</td>
              <td>{a.name}</td>
              <td>
                <SatStatus id={a.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SatStatus({ id }: { id: string }) {
  const a = airportById(id)!;
  const s = towerStatus(a, new Date());
  if (s === 'uncontrolled') return <Pill tone="info">uncontrolled</Pill>;
  const hours = a.hours?.map((h) => `${h.days === 'daily' ? '' : `${h.days} `}${h.open}–${h.close}`).join(' · ');
  return (
    <>
      <Pill tone={s === 'closed' ? 'bad' : 'ok'}>{s === 'closed' ? 'tower closed' : 'towered now'}</Pill> <span className="muted small">{hours}</span>
    </>
  );
}

function SatScratchpads({ facility }: { facility: string }) {
  const rows = DS.approach.satellite_scratchpads.filter((s) => s.facility === facility);
  if (!rows.length) return null;
  return (
    <Card title="Satellite / secondary scratchpads" src={rows[0].src}>
      <table className="grid compact">
        <tbody>
          {rows.map((s) => (
            <tr key={s.code}>
              <td className="mono">{s.code}</td>
              <td>{s.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ArrivalRestrictions({ airport }: { airport: string }) {
  const rows = DS.enroute.arrival_restrictions.filter((r) => r.destination === airport);
  if (!rows.length) return null;
  return (
    <Card title={`${airport} arrivals — how they reach you`} src={rows[0].src}>
      <table className="grid">
        <tbody>
          {rows.map((r) => (
            <tr key={r.aircraft}>
              <th scope="row">{r.aircraft}</th>
              <td>{r.restriction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function AppPage() {
  const { view } = useApp();
  const { values } = usePlan();
  const a = airportById(view.airport)!;
  const tracon = a.tracon;
  const positions = positionsAt(tracon, 'APP', 'DEP');
  const rules = [...rulesFor('APP', a.id), ...rulesFor('ALL', a.id)];
  const twr = primaryAt(a.id, 'TWR');
  const ctr = DS.positions.find((p) => p.id === 'MEM_22_CTR');
  const mine: StripEntry[] = positions.filter((p) => p.primary).map((p) => ({ label: p.name, position: p }));
  const next: StripEntry[] = [];
  if (twr) next.push({ label: 'Tower (arrivals)', position: twr });
  if (ctr) next.push({ label: 'Center (departures)', position: ctr });
  return (
    <>
      <FreqStrip mine={mine.length ? mine : ctr ? [{ label: 'No TRACON — Memphis Center', position: ctr }] : []} next={next} />
      <PageHead
        title="Approach / Departure"
        sub={<span className="muted">{tracon === 'ZME' ? 'No TRACON: ZME owns the airspace' : tracon.replace('_TRACON', ' TRACON')}</span>}
      />
      <Tabs />
      {view.tab === 'cheat' && (
        <div className="cols">
          <Card title="Positions" className="wide">
            <PositionTable positions={positions} />
            {tracon === 'M03' && <p className="muted small">Staff Arrival East (combined) first, then Final West before any other final.</p>}
          </Card>
          {tracon === 'M03' && <FeederTable />}
          <Card title="STAR → runway" src={{ doc: 'm03-tracon-sop', sec: '6-1-1' }}>
            <StarTable airport={a.id} />
            {a.id === 'MEM' && <p className="muted small">Highlighted runways are in the selected flow's arrival set.</p>}
          </Card>
          {a.id === 'MEM' && <ScratchpadTable />}
          <ArrivalRestrictions airport={a.id} />
          <SatelliteCard tracon={tracon} />
          <ProceduresCard airport={a.id} role="APP" />
          <Callouts rules={rules} />
        </div>
      )}
      {view.tab === 'scripts' && <ScriptsTab role="APP" airport={a.id} values={values} />}
      {view.tab === 'ref' && (
        <div className="cols">
          <SatScratchpads facility={tracon} />
          <ApproachesCard airport={a.id} />
          <ArrivalRestrictions airport={a.id} />
          <ChartsCard airport={a.id} />
          <Card title="Maps & lists">
            <p>
              <SourceTag src={{ doc: 'zme-approach-controls' }} /> <SourceTag src={{ doc: 'zme-frequency-list' }} />{' '}
              <SourceTag src={{ doc: 'vor-reference-sheet' }} />
            </p>
          </Card>
        </div>
      )}
      {view.tab === 'docs' && (
        <DocsTab
          srcs={pageSrcs('APP', a.id, [
            ...positions.map((p) => p.src),
            ...DS.stars.filter((s) => s.airport === a.id).map((s) => s.src),
            tracon === 'M03' ? DS.approach.feeder_altitudes.src : undefined,
          ])}
          extraDocs={['zme-approach-controls', `${a.id.toLowerCase()}-loa`].filter((d) => DS.docs.some((x) => x.id === d))}
        />
      )}
    </>
  );
}
