import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

function gitValue(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const packageVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }).version ?? '0.0.0';
const commitTime = gitValue('show -s --format=%cI HEAD') || new Date().toISOString();
const commitHash = gitValue('rev-parse --short HEAD');

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
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __COMMIT_TIME__: JSON.stringify(commitTime),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react(), serviceWorkerManifest()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react';
          if (id.includes('/node_modules/@fluentui/react-icons/')) return 'icons';
          return undefined;
        },
      },
    },
  },
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
