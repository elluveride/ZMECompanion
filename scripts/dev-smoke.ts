// Dev-server smoke test: push the entry points and the virtual data module through Vite's dev
// transform pipeline (including import analysis), which `vite build` and `vite preview` never run.
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true } });
let failed = false;
try {
  for (const url of ['/src/main.tsx', '/src/data.ts', 'virtual:zme-data']) {
    try {
      const out = await server.transformRequest(url);
      if (!out?.code) throw new Error('empty result');
      console.log(`ok   ${url}`);
    } catch (e) {
      failed = true;
      console.error(`FAIL ${url}: ${(e as Error).message}`);
    }
  }
} finally {
  // close() can wait on the dependency optimizer's first run; don't let that hang the check.
  await Promise.race([server.close(), new Promise((r) => setTimeout(r, 3000))]);
}
process.exit(failed ? 1 : 0);
