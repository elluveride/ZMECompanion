import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp, type Page, type Tab } from '../state';
import { DS, airportById, docById } from '../data';
import { buildIndex, search } from '../lib/search';
import { inNightWindow, localParts } from '../lib/hours';
import { airacFor, isStaleAirac } from '../lib/airac';
import type { Position } from '../../schema/schema';
import { Freq } from './ui';

const NAV: { page: Page; label: string }[] = [
  { page: 'del', label: 'DEL' },
  { page: 'gnd', label: 'GND' },
  { page: 'twr', label: 'TWR' },
  { page: 'app', label: 'APP/DEP' },
  { page: 'ctr', label: 'CTR' },
];
const TOOLS: { page: Page; label: string }[] = [
  { page: 'strip', label: 'Strips' },
  { page: 'library', label: 'Library' },
  { page: 'issues', label: 'Discrepancies' },
];

export function TopBar() {
  const { view, setView } = useApp();
  const flows = DS.flows.filter((f) => f.airport === view.airport);
  const open = DS.discrepancies.filter((d) => d.status === 'open').length;
  const night = inNightWindow(new Date());
  const majors = DS.airports.filter((a) => a.group === 'major');
  const minors = DS.airports.filter((a) => a.group === 'minor');
  return (
    <header className="top">
      <a className="brand" href="#/del" onClick={(e) => (e.preventDefault(), setView({ page: 'del' }))}>
        <img src="./icon.svg" alt="" width={22} height={22} />
        <span>ZME Companion</span>
      </a>
      <nav className="posnav" aria-label="Positions">
        {NAV.map((n) => (
          <a
            key={n.page}
            href={`#/${n.page}`}
            className={view.page === n.page ? 'on' : ''}
            aria-current={view.page === n.page ? 'page' : undefined}
            onClick={(e) => (e.preventDefault(), setView({ page: n.page }))}
          >
            {n.label}
          </a>
        ))}
        <span className="sep" />
        {TOOLS.map((n) => (
          <a
            key={n.page}
            href={`#/${n.page}`}
            className={`tool ${view.page === n.page ? 'on' : ''}`}
            onClick={(e) => (e.preventDefault(), setView({ page: n.page }))}
          >
            {n.label}
            {n.page === 'issues' && open > 0 && <span className="count">{open}</span>}
          </a>
        ))}
      </nav>
      <div className="ctx">
        <label className="ctl">
          <span>Airport</span>
          <select value={view.airport} onChange={(e) => setView({ airport: e.target.value })} aria-label="Airport">
            <optgroup label="Airports">
              {majors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}
                </option>
              ))}
            </optgroup>
            <optgroup label="Minor fields">
              {minors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="ctl" role="group" aria-label="Flow">
          <span>Flow</span>
          <div className="seg">
            {flows.length ? (
              flows.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={view.flow === f.id ? 'on' : ''}
                  onClick={() => setView({ flow: f.id })}
                  aria-pressed={view.flow === f.id}
                >
                  {f.name.replace(/ \(.*\)$/, '')}
                </button>
              ))
            ) : (
              <button type="button" disabled>
                n/a
              </button>
            )}
          </div>
        </div>
        {view.airport === 'MEM' && (
          <label className={`ctl night ${night ? 'window' : ''}`} title="Unlocks the 0200–0600 local RNAV SIDs at MEM (MEM ATCT SOP 2-1-3)">
            <span>Night{night && ' ●'}</span>
            <input type="checkbox" role="switch" checked={view.night} onChange={(e) => setView({ night: e.target.checked })} aria-label="Night 0200–0600" />
          </label>
        )}
      </div>
      <SearchBox />
    </header>
  );
}

function SearchBox() {
  const index = useMemo(() => buildIndex(DS), []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(index, q), [index, q]);
  const go = (href: string) => {
    location.hash = href;
    setQ('');
    input.current?.blur();
  };
  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        placeholder="Search fixes, SIDs, freqs, callsigns…"
        aria-label="Search"
        value={q}
        onChange={(e) => (setQ(e.target.value), setSel(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, results.length - 1)));
          if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
          if (e.key === 'Enter' && results[sel]) go(results[sel].href);
          if (e.key === 'Escape') setQ('');
        }}
      />
      {results.length > 0 && (
        <ul className="results" role="listbox">
          {results.map((h, i) => (
            <li
              key={`${h.kind}:${h.label}:${i}`}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? 'sel' : ''}
              onMouseDown={(e) => (e.preventDefault(), go(h.href))}
            >
              <b className="mono">{h.label}</b> <span className="kind">{h.kind}</span>
              <div className="muted small">{h.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type StripEntry = { label: string; position?: Position; freq?: string; note?: string };

/** Sticky strip: my frequency → the next-up handoff frequency. */
export function FreqStrip({ mine, next }: { mine: StripEntry[]; next: StripEntry[] }) {
  const one = (e: StripEntry, i: number) => (
    <span key={i} className="fs-item">
      <span className="fs-label">{e.label}</span>
      {e.position?.callsign && <span className="mono muted">{e.position.callsign}</span>}
      {(e.freq ?? e.position?.freq) && <Freq freq={(e.freq ?? e.position?.freq)!} />}
      {e.note && <span className="muted small">{e.note}</span>}
    </span>
  );
  return (
    <div className="freqstrip" aria-label="Frequencies">
      {mine.map(one)}
      {next.length > 0 && <span className="arrow">→</span>}
      {next.map(one)}
    </div>
  );
}

export function Tabs({ extra }: { extra?: ReactNode }) {
  const { view, setView } = useApp();
  const tabs: { id: Tab; label: string }[] = [
    { id: 'cheat', label: 'Cheat sheet' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'ref', label: 'Reference' },
    { id: 'docs', label: 'Docs' },
  ];
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={view.tab === t.id}
          className={view.tab === t.id ? 'on' : ''}
          onClick={() => setView({ tab: t.id })}
        >
          {t.label}
        </button>
      ))}
      {extra}
    </div>
  );
}

export function PageHead({ title, sub }: { title: string; sub?: ReactNode }) {
  const { view } = useApp();
  const a = airportById(view.airport);
  return (
    <div className="pagehead">
      <h1>
        {title} <span className="muted">· {a?.icao}</span>
      </h1>
      {sub}
    </div>
  );
}

export function Footer() {
  const now = new Date();
  const card = docById('reference-card');
  const stale = isStaleAirac(card?.airac, now);
  const { hhmm } = localParts(now);
  return (
    <footer className="foot">
      <p>
        <b>For VATSIM use only.</b> Every ZME document says it “shall not be used for real world operations”; the virtual Memphis ARTCC has no affiliation with
        the real-world Memphis ARTCC, the FAA, or any federal entity. Neither does this app.
      </p>
      <p className="muted small">
        Data transcribed from the ZME Files page; tap any source tag to open the PDF. Reference Card AIRAC {card?.airac}
        {stale && <span className="stale-badge"> · older than current cycle {airacFor(now).ident}</span>} · ZME local time {hhmm}
      </p>
    </footer>
  );
}
