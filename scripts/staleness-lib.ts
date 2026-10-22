// Pure diff between the live ZME Files list and data/docs.yaml (used by scripts/staleness.ts).
export type Remote = { id: string; name: string; type: string; updated_at: string };
export type Local = { id: string; title: string; site_id?: string; site_updated?: string };

export function compare(remote: Remote[], local: Local[]) {
  const bySite = new Map(local.filter((d) => d.site_id).map((d) => [d.site_id!, d]));
  const updated: string[] = [];
  const added: string[] = [];
  for (const r of remote) {
    const d = bySite.get(r.id);
    const day = r.updated_at.slice(0, 10);
    if (!d) added.push(`- **${r.name}** (${r.type}) — new on the Files page, updated ${day}`);
    else if (!d.site_updated || day > d.site_updated)
      updated.push(`- **${d.title}** (\`${d.id}\`) — Files page says ${day}, data/ transcribed against ${d.site_updated ?? 'unknown'}`);
  }
  const remoteIds = new Set(remote.map((r) => r.id));
  const removed = local.filter((d) => d.site_id && !remoteIds.has(d.site_id)).map((d) => `- **${d.title}** (\`${d.id}\`) — no longer on the Files page`);
  return { updated, added, removed };
}
