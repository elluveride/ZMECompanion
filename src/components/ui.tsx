import { useState, type ReactNode } from 'react';
import type { Src } from '../../schema/schema';
import { SourceTag, FlagBadge } from './Source';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    });
  };
  return [copied, copy];
}

/** A frequency that copies itself on tap. */
export function Freq({ freq, label }: { freq: string; label?: string }) {
  const [copied, copy] = useCopy();
  return (
    <button type="button" className={`freq${copied ? ' copied' : ''}`} onClick={() => copy(freq, freq)} title={`Copy ${freq}`}>
      {label && <span className="freq-label">{label}</span>}
      <span className="mono">{copied ? 'copied' : freq}</span>
    </button>
  );
}

export function Card({
  title,
  src,
  children,
  className,
  actions,
  id,
}: {
  title: ReactNode;
  src?: Src | Src[];
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <section className={`card ${className ?? ''}`} id={id}>
      <header className="card-h">
        <h2>{title}</h2>
        {actions}
        <SourceTag src={src} />
      </header>
      <div className="card-b">{children}</div>
    </section>
  );
}

export type KvRow = { label: ReactNode; value: ReactNode; src?: Src | Src[]; flag?: string; key?: string; hot?: boolean };

/** Two-column label/value table with a source tag per row. */
export function KvTable({ rows }: { rows: KvRow[] }) {
  return (
    <table className="kv">
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key ?? i} className={r.hot ? 'hot' : undefined}>
            <th scope="row">{r.label}</th>
            <td>
              {r.value} <FlagBadge id={r.flag} />
            </td>
            <td className="src-cell">
              <SourceTag src={r.src} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'info' }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}
