import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

function walk(directory: string, base = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? walk(path.join(directory, entry.name), relative)
      : [relative];
  });
}

/**
 * Emits a precache list for the hand-written service worker and versions the
 * cache name with the emitted file set, so a new deploy installs and refreshes
 * the local cache.
 */
function serviceWorkerManifest(): Plugin {
  return {
    name: 'asteria-sw-manifest',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      const files = walk(dist).filter((file) => {
        if (file === 'sw.js' || file === 'sw-assets.json' || file.endsWith('.map')) return false;
        if (file.startsWith('demo/audio/') || file.startsWith('demo/video/')) return false;
        return true;
      });
      const assets = files.map((file) => `./${file.replace(/\\/g, '/')}`);
      const version = createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 10);
      writeFileSync(
        path.join(dist, 'sw-assets.json'),
        JSON.stringify({ version, assets }, null, 2),
      );
      const swPath = path.join(dist, 'sw.js');
      const source = readFileSync(swPath, 'utf8').replace("'asteria-v1'", `'asteria-${version}'`);
      writeFileSync(swPath, source);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerManifest()],
  server: {
    port: 4173,
    strictPort: true,
    watch: {
      ignored: ['**/screenshots/**', '**/*.tmpdir/**', '**/dist/**'],
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
