import type { Sid } from '../../schema/schema';
import { useApp } from '../state';
import { DS, airportById } from '../data';
import { sidsFor, isUnavailable } from '../lib/departure';
import { ft, hdg } from '../lib/format';
import { Card, KvTable, Freq, Pill, Empty, type KvRow } from '../components/ui';
import { SourceTag, FlagBadge, flagFor } from '../components/Source';
import { Callouts, rulesFor, ScriptsTab, DocsTab, ChartsCard, ChartLink, ProceduresCard, FactsCard } from '../components/blocks';
import { FlightPanel } from '../components/FlightPanel';
import { PdcChecker } from '../components/PdcChecker';
import { FreqStrip, Tabs, PageHead, type StripEntry } from '../components/Shell';
import { usePlan, positionsAt, primaryAt, pageSrcs } from './common';

/** Runway columns as the Reference Card groups them, per airport. */
const SID_COLUMNS: Record<string, { label: string; rwy: string }[]> = {
  MEM: [
    { label: '36L', rwy: '36L' },
    { label: '36C/R', rwy: '36C' },
    { label: '18L/C', rwy: '18L' },
    { label: '18R', rwy: '18R' },
  ],
  BNA: [
    { label: '2C/2L/2R', rwy: '2L' },
    { label: '20C/20L/20R', rwy: '20L' },
    { label: '13/31', rwy: '13' },
  ],
};

function FixCell({ sid, rwy }: { sid: Sid; rwy: string }) {
  const v = sid.fix[rwy];
  if (!v) return <td className="muted">—</td>;
  return (
    <td className="mono">
      {v} <FlagBadge id={flagFor({ flags: sid.flags }, `fix.${rwy}`)} />
    </td>
  );
}

export function SidTable({ airport, full }: { airport: string; full?: boolean }) {
  const { view } = useApp();
  const cols = SID_COLUMNS[airport] ?? [];
  const all = sidsFor(DS, airport).filter((s) => s.rnav);
  const shown = full ? all : all.filter((s) => !isUnavailable(s, view.night));
  const hidden = all.length - shown.length;
  if (!all.length) return <Empty>No RNAV SIDs transcribed for this airport.</Empty>;
  return (
    <>
      <div className="scroll">
        <table className="grid sids">
          <thead>
            <tr>
              <th>SID</th>
              {airport === 'MEM' && <th>Say</th>}
              <th>Trans</th>
              {cols.map((c) => (
                <th key={c.label} className="mono">
                  {c.label}
                </th>
              ))}
              {airport === 'MEM' && <th title="M03 SOP 5-1-1: fly runway heading, vectors to this fix">9/27</th>}
              {full && airport === 'MEM' && <th>ELVIS gate</th>}
              {full && airport === 'BNA' && <th>Waypoint</th>}
              <th>Side</th>
              {full && <th>Pref. rwy N/S</th>}
              <th>Night</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const off = isUnavailable(s, view.night);
              return (
                <tr key={s.name} className={off ? 'unavailable' : undefined} data-sid={s.name}>
                  <td className="mono">
                    <ChartLink airport={airport} stem={s.base.toLowerCase()}>
                      {s.name}
                    </ChartLink>
                  </td>
                  {airport === 'MEM' && <td className="small">{s.say}</td>}
                  <td className="mono small">{s.transition}</td>
                  {cols.map((c) => (
                    <FixCell key={c.label} sid={s} rwy={c.rwy} />
                  ))}
                  {airport === 'MEM' && <td className="mono muted">{s.fix_9_27}</td>}
                  {full && airport === 'MEM' && <td className="mono small">{s.gate}</td>}
                  {full && airport === 'BNA' && <td className="mono small">{s.waypoint}</td>}
                  <td className="small">{s.side}</td>
                  {full && <td className="mono small">{[s.preferred?.north, s.preferred?.south].filter(Boolean).join(' / ')}</td>}
                  <td>{s.availability === 'night' ? <Pill tone={off ? 'bad' : 'warn'}>{off ? 'unavailable' : '0200–0600'}</Pill> : ''}</td>
                  <td className="src-cell">
                    <FlagBadge id={flagFor({ flags: s.flags }, 'name')} />
                    <SourceTag src={s.src} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hidden > 0 && <p className="muted small">{hidden} night-only SIDs hidden — turn on Night (0200–0600 local) to show them.</p>}
    </>
  );
}

function ClearanceCard() {
  const { view } = useApp();
  const { plan } = usePlan();
  const rows: KvRow[] = [];
  if (plan.sid)
    rows.push({
      label: 'SID',
      value: (
        <span className="mono">
          {plan.sid.name}
          {plan.sid.say ? ` “${plan.sid.say}”` : ''}
        </span>
      ),
      src: plan.sid.src,
      flag: flagFor({ flags: plan.sid.flags }, 'name'),
    });
  if (plan.runway)
    rows.push({
      label: 'Departure runway',
      value: (
        <>
          <span className="mono">{plan.runway}</span> <span className="muted small">{plan.runwayReason}</span>
        </>
      ),
    });
  if (plan.fix)
    rows.push({
      label: 'Initial fix',
      value: <span className="mono big-val">{plan.fix.runwayHeading ? plan.fix.note : plan.fix.name}</span>,
      src: plan.sid?.src,
      flag: plan.fix.flag,
    });
  if (plan.initialAlt)
    rows.push({
      label: 'Initial altitude',
      value: (
        <span className="mono big-val">
          {ft(plan.initialAlt.feet)}
          {plan.initialAlt.filedLower ? ' (filed)' : ''}
        </span>
      ),
      src: plan.initialAlt.src,
      flag: plan.initialAlt.flag,
    });
  if (plan.depFreq)
    rows.push({
      label: 'Departure frequency',
      value: (
        <>
          <span>{plan.depFreq.position?.radio ?? plan.depFreq.label}</span> <Freq freq={plan.depFreq.freq} />{' '}
          <span className="muted small">{plan.depFreq.position?.callsign ?? plan.depFreq.note}</span>
        </>
      ),
      src: plan.depFreq.src,
    });
  else if (plan.airport && !plan.side && plan.airport.id === 'MEM')
    rows.push({ label: 'Departure frequency', value: <span className="muted">Pick a SID (or ELVIS transition) to choose East 124.150 / West 124.650</span> });
  if (plan.heading && plan.takeoff !== 'rnav')
    rows.push({ label: 'Tower heading', value: <span className="mono">{plan.heading.value}</span>, src: plan.heading.rule.src });
  return (
    <Card title={`Clearance · ${view.airport}`} className="clearance">
      {rows.length ? <KvTable rows={rows} /> : <Empty>Enter a flight above (or tap Example).</Empty>}
    </Card>
  );
}

function DelCheatCard({ airport }: { airport: string }) {
  const a = airportById(airport)!;
  const del = positionsAt(airport, 'DEL');
  const gnd = primaryAt(airport, 'GND');
  const atis = primaryAt(airport, 'ATIS');
  const deps = positionsAt(a.tracon, 'DEP');
  const rows: KvRow[] = [];
  for (const p of del)
    rows.push({
      label: 'Position',
      value: (
        <>
          {p.radio} · <span className="mono">{p.callsign}</span> · <Freq freq={p.freq} />
        </>
      ),
      src: p.src,
    });
  if (!del.length && gnd)
    rows.push({
      label: 'Clearances by',
      value: (
        <>
          {gnd.radio} · <span className="mono">{gnd.callsign}</span> · <Freq freq={gnd.freq} />{' '}
          <span className="muted small">(no DEL position — Ground issues IFR clearances)</span>
        </>
      ),
      src: gnd.src,
    });
  if (atis)
    rows.push({
      label: 'ATIS',
      value: (
        <>
          <span className="mono">{atis.callsign ?? 'ATIS'}</span> · <Freq freq={atis.freq} />
        </>
      ),
      src: atis.src,
    });
  if (a.initial_alt) {
    if (a.initial_alt.jet !== a.initial_alt.prop) {
      rows.push({ label: 'Initial altitude, turbojet', value: `${ft(a.initial_alt.jet)} or lower filed`, src: a.initial_alt.src, flag: a.initial_alt.flag });
      rows.push({
        label: 'Initial altitude, non-turbojet',
        value: `${ft(a.initial_alt.prop)} or lower filed`,
        src: a.initial_alt.src,
        flag: a.initial_alt.flag,
      });
    } else rows.push({ label: 'Initial altitude', value: a.initial_alt.text, src: a.initial_alt.src, flag: a.initial_alt.flag });
  }
  const rnavRule = rulesFor('DEL', airport).find((r) => r.id === 'rnav-jets');
  if (rnavRule) rows.push({ label: 'RNAV SIDs', value: 'Jets only; props get ELVIS', src: rnavRule.src });
  const elvis = DS.sids.find((s) => s.airport === airport && s.base === 'ELVIS');
  if (elvis) rows.push({ label: 'No-SID / ELVIS', value: `Assign ${elvis.name}; tower issues the heading`, src: elvis.src });
  for (const d of deps)
    rows.push({
      label: `Departure ${d.side === 'east' ? 'East' : 'West'}`,
      value: (
        <>
          {d.radio} · <span className="mono">{d.callsign}</span> · <Freq freq={d.freq} />
        </>
      ),
      src: d.src,
    });
  if (a.dep_freq_order)
    rows.push({
      label: 'Departure frequency order',
      value: a.dep_freq_order.rows.map((r, i) => (
        <span key={i}>
          {i > 0 && ' → '}
          {r.label} <Freq freq={r.freq} />
        </span>
      )),
      src: a.dep_freq_order.src,
    });
  const pdcRule = DS.rules.find((r) => r.id === 'pdc-airports');
  rows.push({ label: 'PDC', value: a.pdc ? `Required at ${a.id} for eligible flights` : 'Not a PDC airport — voice', src: pdcRule?.src });
  return (
    <Card title="DEL cheat sheet" className="cheat">
      <KvTable rows={rows} />
    </Card>
  );
}

export function DelPage() {
  const { view } = useApp();
  const { plan, values } = usePlan();
  const a = airportById(view.airport)!;
  const del = primaryAt(a.id, 'DEL') ?? primaryAt(a.id, 'GND');
  const gnd = primaryAt(a.id, 'GND');
  const rules = [...rulesFor('DEL', a.id), ...rulesFor('ALL', a.id)];
  const elvis = DS.sids.find((s) => s.airport === a.id && s.base === 'ELVIS');
  const atis = primaryAt(a.id, 'ATIS');
  const mine: StripEntry[] = [];
  if (del) mine.push({ label: del.role === 'DEL' ? 'Clearance' : 'Ground (clearances)', position: del });
  if (atis) mine.push({ label: 'ATIS', position: atis });
  return (
    <>
      <FreqStrip mine={mine} next={gnd && del?.role === 'DEL' ? [{ label: 'Ground', position: gnd }] : []} />
      <PageHead title="Clearance Delivery" />
      <Tabs />
      {view.tab === 'cheat' && (
        <div className="cols">
          <FlightPanel plan={plan} compact />
          <ClearanceCard />
          <DelCheatCard airport={a.id} />
          <PdcChecker />
          <Card
            title={`${a.id} RNAV SIDs — initial waypoint by runway`}
            className="wide"
            src={{ doc: 'reference-card', sec: a.id === 'MEM' ? 'MEM Departures' : 'Nashville Departures' }}
          >
            <SidTable airport={a.id} />
          </Card>
          <ProceduresCard airport={a.id} role="GND" />
          <Callouts rules={rules} />
        </div>
      )}
      {view.tab === 'scripts' && (
        <ScriptsTab role="DEL" airport={a.id} values={values}>
          <FlightPanel plan={plan} compact />
        </ScriptsTab>
      )}
      {view.tab === 'ref' && (
        <div className="cols">
          <Card title={`${a.id} SIDs — full table`} className="wide" src={{ doc: 'reference-card' }}>
            <SidTable airport={a.id} full />
            {elvis && (
              <ul className="rules small">
                {elvis.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </Card>
          {a.id === 'MEM' && <ElvisCard />}
          {a.id === 'MEM' && <InitialHeadingsCard />}
          <InitialAltGuidance />
          <OtherSids />
          <FactsCard title={`${a.icao} facts`} airport={a.id} />
          <ChartsCard airport={a.id} />
        </div>
      )}
      {view.tab === 'docs' && (
        <DocsTab
          srcs={pageSrcs('DEL', a.id, [
            a.initial_alt?.src,
            ...sidsFor(DS, a.id).map((s) => s.src),
            ...positionsAt(a.id, 'DEL', 'ATIS').map((p) => p.src),
            a.dep_freq_order?.src,
          ])}
          extraDocs={['zme-pre-departure-clearance-policy', 'vatis-profiles', 'vatis-readme']}
        />
      )}
    </>
  );
}

function ElvisCard() {
  return (
    <Card
      title="ELVIS transitions (MEM)"
      src={[
        { doc: 'kmem-atct-sop', sec: '2-1-3' },
        { doc: 'kmem-atct-sop', sec: '4-1-5' },
      ]}
    >
      <table className="grid">
        <thead>
          <tr>
            <th>Transition</th>
            <th>Gate</th>
            <th>Side</th>
            <th>Availability</th>
          </tr>
        </thead>
        <tbody>
          {DS.elvis.map((e) => (
            <tr key={e.name}>
              <td className="mono">{e.name}</td>
              <td>{e.direction}</td>
              <td>{e.side}</td>
              <td className="small">{e.availability === 'always' ? '—' : e.availability === 'night' ? '0200–0600 or M03 approval' : e.availability_note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function InitialHeadingsCard() {
  const t = DS.references.initial_headings_from_mem;
  return (
    <Card title="Initial heading from MEM by destination" src={t.src}>
      <p className="muted small">As printed: {t.header}</p>
      <table className="grid compact">
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.dest}>
              <td className="mono">{r.dest}</td>
              <td className="mono">{hdg(r.heading)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function InitialAltGuidance() {
  const t = DS.references.initial_altitude_guidance;
  return (
    <Card title="Initial altitude guidance (all airports)" src={t.src}>
      <table className="grid compact">
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.airport}>
              <td>{r.airport}</td>
              <td className="mono">
                {r.value} <FlagBadge id={r.flag} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function OtherSids() {
  const t = DS.references.other_sids;
  return (
    <Card title="Other airports' SIDs" src={t.src}>
      <table className="grid compact">
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.airport}>
              <td className="mono">{r.airport}</td>
              <td>{r.sid}</td>
              <td className="mono small">{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
