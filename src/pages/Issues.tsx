import { DS } from '../data';
import { Card, Pill } from '../components/ui';
import { SourceTag } from '../components/Source';
import { PageHead } from '../components/Shell';

export function IssuesPage() {
  return (
    <>
      <PageHead title="Source discrepancies" sub={<span className="muted">Shown with a ⚠ badge wherever they appear until ZME staff confirm a value</span>} />
      <div className="cols">
        {DS.discrepancies.map((d) => (
          <Card
            key={d.id}
            title={
              <>
                <span className="flag-id" data-flag={d.id}>
                  ⚠ {d.id}
                </span>{' '}
                {d.title}
              </>
            }
            actions={
              <span className="card-actions">
                <Pill tone={d.status === 'open' ? 'warn' : 'ok'}>{d.status}</Pill>
                <Pill tone="info">{d.found === 'spec' ? 'in spec' : 'found in build'}</Pill>
              </span>
            }
          >
            <table className="grid">
              <tbody>
                {d.values.map((v, i) => (
                  <tr key={i}>
                    <td className="mono">{v.value}</td>
                    <td className="small">{v.label}</td>
                    <td className="src-cell">
                      <SourceTag src={v.src} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.note && <p className="muted small">{d.note}</p>}
            {d.resolution && <p className="small">Resolution: {d.resolution}</p>}
          </Card>
        ))}
        <Card title="Open questions" className="wide">
          <ul className="rules">
            {DS.questions.map((q) => (
              <li key={q.id}>
                <b>{q.id}.</b> {q.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
