// Pipeline step 3: find values that disagree between sources. A conflict that no record flags
// with a discrepancy (data/discrepancies.yaml) fails the run, so new conflicts can't slip in silently.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset } from '../schema/build';
import { crossCheck } from './crosscheck-lib';

const ds = loadDataset(join(dirname(fileURLToPath(import.meta.url)), '..', 'data'));
const findings = crossCheck(ds);
for (const f of findings) console.log(`${f.known ? `known (${f.known})` : f.level === 'warn' ? 'warn' : 'NEW CONFLICT'} · ${f.text}`);
const fresh = findings.filter((f) => !f.known && f.level === 'conflict');
console.log(`\n${findings.length} finding(s); ${fresh.length} unflagged conflict(s).`);
process.exit(fresh.length ? 1 : 0);
