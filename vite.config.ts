import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Phase 1: plain Vite + Phaser. No framework plugin — the game world is
// rendered by Phaser, not by React or any DOM framework.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // Phaser's source build optionally requires this WebGL-debug module;
      // stub it so Node-based tooling (vitest) can import Phaser.
      phaser3spectorjs: path.resolve(rootDir, 'tests/smoke/emptyModule.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Preview/proxy hosts (sandbox live preview) must be accepted.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500, // phaser.js is a single large vendor chunk
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Installs the headless canvas stub before Phaser is imported.
    // No-op for pure-logic tests running in the node environment.
    setupFiles: ['./tests/smoke/setup.ts'],
    alias: [
      // Use Phaser's prebuilt bundle in tests: a single copy for every
      // importer, without the source build's optional debug requires.
      { find: /^phaser$/, replacement: path.resolve(rootDir, 'node_modules/phaser/dist/phaser.js') },
    ],
  },
});
