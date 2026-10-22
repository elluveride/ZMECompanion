/// <reference types="vitest/config" />
import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { loadDataset } from './schema/build';

const DATA_DIR = fileURLToPath(new URL('./data', import.meta.url));
/** Vite reports changed files with forward slashes on every OS. */
const DATA_DIR_POSIX = normalizePath(DATA_DIR) + '/';
const VIRTUAL_ID = 'virtual:zme-data';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Validates data/*.yaml at build/dev time and serves it as a JSON module; a bad record fails the build. */
function zmeData(): Plugin {
  return {
    name: 'zme-data',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    // No this.addWatchFile() here: in dev Vite treats watch files added during load() as imports
    // and tries to resolve them, which fails for the data directory on Windows. data/ is inside the
    // project root, so Vite's watcher already reports its changes to handleHotUpdate below.
    load(id) {
      if (id !== RESOLVED_ID) return;
      return `export default ${JSON.stringify(loadDataset(DATA_DIR))};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(DATA_DIR_POSIX)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    zmeData(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ZME Position Companion',
        short_name: 'ZME Companion',
        description: 'Second-monitor companion for ZME (Memphis ARTCC) VATSIM controllers. VATSIM use only.',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
