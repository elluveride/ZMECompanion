import { useMemo, type ReactNode } from 'react';
import type { Position, Rule, Script, Src } from '../../schema/schema';
import { DS, docById, airportById } from '../data';
import { SourceTag, FlagBadge } from './Source';
import { Card, Freq, useCopy, Empty } from './ui';
import { fillTemplate, segmentsToText, type SlotValues } from '../lib/slots';
import { airacFor } from '../lib/airac';
import type { Role } from '../../schema/schema';

export function rulesFor(role: Role | 'ALL', airport: string): Rule[] {
  return DS.rules.filter((r) => r.scope === role && (!r.airport || r.airport === airport));
}

export function Callouts({ rules, title = 'Rules' }: { rules: Rule[]; title?: string }) {
  if (!rules.length) return null;
  return (
    <Card title={title} className="callouts wide">
      <ul className="rules">
        {rules.map((r) => (
          <li key={r.id} className={`rule ${r.kind}`}>
            <b>{r.title}.</b> {r.text} <SourceTag src={r.src} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PositionTable({ positions, showOwns = true }: { positions: Position[]; showOwns?: boolean }) {
  if (!positions.length) return <Empty>No positions transcribed for this facility yet.</Empty>;
  return (
    <div className="scroll">
      <table className="grid">
        <thead>
          <tr>
            <th>Position</th>
            <th>Callsign</th>
            <th>Freq</th>
            {showOwns && <th>Owns / notes</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} className={p.primary ? 'primary' : undefined}>
              <td>
                {p.name}
                {p.primary && (
                  <span className="star" title="Primary / combined position">
                    {' '}
                    ★
                  </span>
                )}
                {p.radio && <div className="muted small">{p.radio}</div>}
              </td>
              <td className="mono">{p.callsign ?? '—'}</td>
              <td>
                <Freq freq={p.freq} />
              </td>
              {showOwns && <td className="small">{[p.owns, p.note].filter(Boolean).join(' ')}</td>}
              <td className="src-cell">
                <SourceTag src={p.src} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phraseology with auto-filled slots; empty slots stay visible as {slot}. */
export function ScriptCard({ script, values }: { script: Script; values: SlotValues }) {
  const [copied, copy] = useCopy();
  const lines = script.template.split('\n');
  const rendered = lines.map((line) => {
    const other = line.startsWith('> ');
    const segs = fillTemplate(other ? line.slice(2) : line, values);
    return { other, segs };
  });
  const text = rendered.map((l) => (l.other ? '> ' : '') + segmentsToText(l.segs)).join('\n');
  const missing = rendered.some((l) => l.segs.some((s) => s.slot && !s.filled));
  return (
    <div className="script">
      <div className="script-h">
        <b>{script.name}</b>
        <SourceTag src={script.src} />
        <button type="button" className="btn small" onClick={() => copy(script.id, text)}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className={`script-b${missing ? ' partial' : ''}`}>
        {rendered.map((l, i) => (
          <p key={i} className={l.other ? 'other' : undefined}>
            {l.segs.map((s, j) =>
              s.slot ? (
                <span key={j} className={s.filled ? 'slot filled' : 'slot empty'} title={s.slot}>
                  {s.text}
                </span>
              ) : (
                <span key={j}>{s.text}</span>
              ),
            )}
          </p>
        ))}
      </div>
      {script.note && (
        <p className="muted small">
          {fillTemplate(script.note, values)
            .map((s) => s.text)
            .join('')}
        </p>
      )}
    </div>
  );
}

export function ScriptsTab({ role, airport, values, children }: { role: Role; airport: string; values: SlotValues; children?: ReactNode }) {
  const scripts = DS.scripts.filter((s) => s.role === role && (!s.airports || s.airports.includes(airport)));
  return (
    <div className="cols">
      {children}
      <Card title="Scripts" className="wide">
        <p className="muted small">
          Slots fill from the top bar and the active flight. Unfilled slots stay as <span className="slot empty">{'{slot}'}</span>.
        </p>
        {scripts.length ? scripts.map((s) => <ScriptCard key={s.id} script={s} values={values} />) : <Empty>No scripts for this airport yet.</Empty>}
      </Card>
    </div>
  );
}

/** Every document section this page draws on, grouped by document, each linking to its PDF. */
export function DocsTab({ srcs, extraDocs = [] }: { srcs: Src[]; extraDocs?: string[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of srcs) {
      if (!m.has(s.doc)) m.set(s.doc, new Set());
      if (s.sec) m.get(s.doc)!.add(s.sec);
    }
    for (const d of extraDocs) if (!m.has(d)) m.set(d, new Set());
    const rank = { sop: 0, policy: 1, loa: 2, reference: 3, misc: 4, vatis: 5, external: 6 } as const;
    return [...m.entries()]
      .map(([id, secs]) => ({ doc: docById(id)!, secs: [...secs].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) }))
      .filter((x) => x.doc)
      .sort((a, b) => rank[a.doc.category] - rank[b.doc.category] || a.doc.title.localeCompare(b.doc.title));
  }, [srcs, extraDocs]);
  return (
    <div className="cols">
      <Card title="Governing documents" className="wide">
        <p className="muted small">
          Facility SOP → General Operating Procedures → FAA JO 7110.65: the SOPs are written as supplements to 7110.65, so read top-down.
        </p>
        <ul className="docs">
          {grouped.map(({ doc, secs }) => (
            <li key={doc.id}>
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer">
                  {doc.title}
                </a>
              ) : (
                doc.title
              )}{' '}
              <span className="muted small">
                {[doc.version && `v${doc.version}`, doc.revised && `rev. ${doc.revised}`, doc.airac && `AIRAC ${doc.airac}`].filter(Boolean).join(' · ')}
              </span>
              {secs.length > 0 && (
                <div className="secs">
                  {secs.map((s) => (
                    <SourceTag key={s} src={{ doc: doc.id, sec: s }} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export const dtppCycle = () => airacFor(new Date()).ident;

/** FAA d-TPP link for one chart (stem like "goetz", "ad") at the airport's d-TPP number. */
export function chartUrl(airportId: string, stem: string): string | undefined {
  const a = airportById(airportId);
  return a?.dtpp ? `https://aeronav.faa.gov/d-tpp/${dtppCycle()}/${a.dtpp}${stem}.pdf` : undefined;
}

export function dtppSearchUrl(airportId: string): string {
  const a = airportById(airportId);
  const ident = (a?.icao ?? airportId).replace(/^K(?=[A-Z]{3}$)/, '');
  return `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=${dtppCycle()}&ident=${ident}`;
}

export function ChartLink({ airport, stem, children }: { airport: string; stem: string; children: ReactNode }) {
  const url = chartUrl(airport, stem);
  return url ? (
    <a className="chart" href={url} target="_blank" rel="noreferrer" title={`FAA d-TPP cycle ${dtppCycle()}`}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

export function ChartsCard({ airport, extra }: { airport: string; extra?: ReactNode }) {
  const a = airportById(airport);
  if (!a?.dtpp) return null;
  return (
    <Card title="Charts" src={{ doc: 'faa-dtpp' }}>
      <p>
        <ChartLink airport={airport} stem="ad">
          Airport diagram
        </ChartLink>{' '}
        ·{' '}
        <a href={dtppSearchUrl(airport)} target="_blank" rel="noreferrer">
          All {a.icao} procedures (SIDs, STARs, IAPs)
        </a>
      </p>
      {extra}
      <p className="muted small">Linked live to FAA d-TPP cycle {dtppCycle()} — nothing is rehosted.</p>
    </Card>
  );
}

export function FactsCard({ title, airport, extra }: { title: string; airport: string; extra?: ReactNode }) {
  const a = airportById(airport);
  if (!a?.facts.length) return null;
  return (
    <Card title={title}>
      <table className="kv">
        <tbody>
          {a.facts.map((f) => (
            <tr key={f.label}>
              <th scope="row">{f.label}</th>
              <td>
                {f.value} <FlagBadge id={f.flag} />
              </td>
              <td className="src-cell">
                <SourceTag src={f.src} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {extra}
    </Card>
  );
}

export function ProceduresCard({ airport, role }: { airport: string; role: Role }) {
  const a = airportById(airport);
  const procs = a?.procedures.filter((p) => p.role === role) ?? [];
  if (!procs.length) return null;
  return (
    <>
      {procs.map((p, i) => (
        <Card key={i} title={`${a!.icao} ${role === 'GND' ? 'Ground' : role === 'TWR' ? 'Local' : 'Approach'} procedures`} src={p.src}>
          <ul className="rules">
            {p.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
