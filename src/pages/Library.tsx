import { useState } from 'react';
import { DS } from '../data';
import { isStaleAirac, airacFor } from '../lib/airac';
import { Card, Pill } from '../components/ui';
import { dtppSearchUrl, ChartLink } from '../components/blocks';
import { PageHead } from '../components/Shell';

const CATS = [
  { id: 'policy', label: 'Policies' },
  { id: 'sop', label: 'SOPs' },
  { id: 'loa', label: 'LOAs' },
  { id: 'reference', label: 'References' },
  { id: 'misc', label: 'Misc' },
  { id: 'vatis', label: 'vATIS' },
  { id: 'external', label: 'External' },
] as const;

export function LibraryPage() {
  const [q, setQ] = useState('');
  const now = new Date();
  const t = q.trim().toLowerCase();
  const zmeCount = DS.docs.filter((d) => d.category !== 'external').length;
  const chartAirports = DS.airports.filter((a) => a.dtpp);
  return (
    <>
      <PageHead
        title="Library"
        sub={
          <span className="muted">
            {zmeCount} ZME files + FAA references · current AIRAC {airacFor(now).ident}
          </span>
        }
      />
      <div className="cols">
        <Card
          title="Documents"
          className="wide"
          actions={
            <input className="filter" type="search" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter documents" />
          }
        >
          {CATS.map((c) => {
            const docs = DS.docs.filter((d) => d.category === c.id && (!t || `${d.title} ${d.short}`.toLowerCase().includes(t)));
            if (!docs.length) return null;
            return (
              <div key={c.id} className="libcat">
                <h3>
                  {c.label} <span className="muted">({DS.docs.filter((d) => d.category === c.id).length})</span>
                </h3>
                <div className="scroll">
                  <table className="grid">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Version</th>
                        <th>ZME “Updated”</th>
                        <th>Used by</th>
                        <th>Cited on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => {
                        const cites = DS.citations[d.id] ?? {};
                        const pages = Object.entries(cites).filter(([p]) => p !== 'ALL');
                        return (
                          <tr key={d.id}>
                            <td>
                              {d.url ? (
                                <a href={d.url} target="_blank" rel="noreferrer">
                                  {d.title}
                                </a>
                              ) : (
                                d.title
                              )}
                              {isStaleAirac(d.airac, now) && (
                                <>
                                  {' '}
                                  <Pill tone="warn">AIRAC {d.airac} · stale</Pill>
                                </>
                              )}
                            </td>
                            <td className="small">
                              {[d.version && `v${d.version}`, d.revised && `rev. ${d.revised}`, d.airac && `AIRAC ${d.airac}`].filter(Boolean).join(' · ')}
                            </td>
                            <td className="small mono">{d.site_updated ?? '—'}</td>
                            <td className="small">{d.used_by.join(' ')}</td>
                            <td className="small">{pages.map(([p, secs]) => `${p}${secs.length ? ` (${secs.length})` : ''}`).join(' · ') || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </Card>
        <Card title="Charts (FAA d-TPP)" src={{ doc: 'faa-dtpp' }}>
          <table className="grid compact">
            <tbody>
              {chartAirports.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.icao}</td>
                  <td>
                    <ChartLink airport={a.id} stem="ad">
                      Diagram
                    </ChartLink>
                  </td>
                  <td>
                    <a href={dtppSearchUrl(a.id)} target="_blank" rel="noreferrer">
                      All procedures
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Links are built for the current cycle ({airacFor(now).ident}); ZME PDFs and FAA charts are linked, never rehosted.</p>
        </Card>
      </div>
    </>
  );
}
