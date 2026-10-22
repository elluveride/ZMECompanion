import type { Src } from '../../schema/schema';
import { docById, discrepancyById } from '../data';
import { isStaleAirac, airacFor } from '../lib/airac';

const asList = (src?: Src | Src[]) => (!src ? [] : Array.isArray(src) ? src : [src]);

/** Small pill that names the document + section and opens the PDF. */
export function SourceTag({ src }: { src?: Src | Src[] }) {
  const list = asList(src);
  if (!list.length) return null;
  return (
    <span className="srcs">
      {list.map((s, i) => {
        const d = docById(s.doc);
        if (!d) return null;
        const stale = isStaleAirac(d.airac, new Date());
        const label = `${d.short}${s.sec ? ` ${s.sec}` : ''}`;
        const title = [d.title, d.version && `v${d.version}`, d.revised && `rev. ${d.revised}`, d.airac && `AIRAC ${d.airac}`].filter(Boolean).join(' · ');
        const body = (
          <>
            {label}
            {stale && (
              <span className="stale" title={`Cycle ${d.airac} is older than current AIRAC ${airacFor(new Date()).ident}`}>
                {' '}
                ⟳{d.airac}
              </span>
            )}
          </>
        );
        return d.url ? (
          <a key={i} className="src" href={d.url} target="_blank" rel="noreferrer" title={`${title} — open PDF`} data-doc={d.id}>
            {body}
          </a>
        ) : (
          <span key={i} className="src" title={title} data-doc={d.id}>
            {body}
          </span>
        );
      })}
    </span>
  );
}

/** Warning badge for an open discrepancy: shows every conflicting value with its source. */
export function FlagBadge({ id }: { id?: string }) {
  const d = id ? discrepancyById(id) : undefined;
  if (!d || d.status !== 'open') return null;
  return (
    <details
      className="flag"
      onClick={(e) => e.stopPropagation()}
      onToggle={(e) => {
        // One sheet at a time.
        if (!e.currentTarget.open) return;
        document.querySelectorAll('details.flag[open]').forEach((d) => d !== e.currentTarget && d.removeAttribute('open'));
      }}
    >
      <summary title={d.title} aria-label={`Discrepancy ${d.id}: ${d.title}`}>
        ⚠ {d.id}
      </summary>
      <div className="flag-pop" role="note">
        <button type="button" className="close" aria-label="Close" onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}>
          ×
        </button>
        <strong>
          {d.id} · {d.title}
        </strong>
        <ul>
          {d.values.map((v, i) => (
            <li key={i}>
              <b>{v.value}</b> — {v.label} <SourceTag src={v.src} />
            </li>
          ))}
        </ul>
        {d.note && <p className="muted">{d.note}</p>}
        <p className="muted">
          Unconfirmed — ask ZME staff. <a href="#/issues">All discrepancies</a>
        </p>
      </div>
    </details>
  );
}

/** Flag id for a record field, from `flags: { D4: [fix.36L] }` or a record-level `flag`. */
export function flagFor(rec: { flag?: string; flags?: Record<string, string[]> }, field?: string): string | undefined {
  if (rec.flag) return rec.flag;
  for (const [id, fields] of Object.entries(rec.flags ?? {})) if (!fields.length || (field && fields.includes(field))) return id;
  return undefined;
}
