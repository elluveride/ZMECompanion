import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset, DataError } from '../schema/build';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
try {
  const ds = loadDataset(dir);
  const n = (k: keyof typeof ds) => (Array.isArray(ds[k]) ? (ds[k] as unknown[]).length : 1);
  console.log(
    `data OK — ${n('docs')} docs, ${n('airports')} airports, ${n('positions')} positions, ${n('sids')} SIDs, ` +
      `${n('stars')} STARs, ${n('ait')} AIT procedures, ${n('discrepancies')} discrepancies`,
  );
} catch (e) {
  if (e instanceof DataError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
