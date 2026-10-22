// Staleness watch: compare the live ZME Files page with data/docs.yaml.
// Exit 0 = up to date, 2 = something changed (the scheduled workflow opens an issue), 1 = error.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { compare, type Local, type Remote } from './staleness-lib';

const FILES_API = 'https://memphisartcc.com/files/all';
const docs = parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'docs.yaml'), 'utf8')) as Local[];

const res = await fetch(FILES_API, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`GET ${FILES_API} → ${res.status}`);
  process.exit(1);
}
const { files } = (await res.json()) as { files: Remote[] };
const { updated, added, removed } = compare(files, docs);
if (!updated.length && !added.length && !removed.length) {
  console.log(`All ${files.length} ZME files match data/docs.yaml.`);
  process.exit(0);
}
const section = (title: string, rows: string[]) => (rows.length ? `### ${title}\n${rows.join('\n')}\n` : '');
console.log(
  [
    'The ZME Files page changed since the data was transcribed. Re-read each document, update the YAML records that cite it, then bump `site_updated` (and `version`/`revised`) in `data/docs.yaml`.',
    '',
    section('Updated', updated),
    section('New', added),
    section('Removed', removed),
  ].join('\n'),
);
process.exit(2);
