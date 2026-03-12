import { defineConfig } from 'tsup';

// Don't clean in watch mode - it deletes files before other configs write
const isWatch = process.argv.includes('--watch');

export default defineConfig([
  // Main process - ESM (Electron 39+ supports ESM natively)
  {
    entry: {
      'main/index': 'src/main/index.ts',
    },
    format: ['esm'],
    target: 'node22', // Electron 39 uses Node 22
    platform: 'node',
    splitting: false,
    sourcemap: true,
    clean: !isWatch, // Only clean on full build, not watch
    dts: false,
    outDir: 'dist',
    external: ['electron', 'keytar', 'ws'],
    noExternal: ['get-port', 'uuid', 'zod', 'electron-store'],
    shims: false, // We define __dirname manually in the source
    treeshake: true,
  },
  // Host process - ESM
  {
    entry: {
      'host/index': 'src/host/index.ts',
    },
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    splitting: false,
    sourcemap: true,
    clean: false,
    dts: false,
    outDir: 'dist',
    external: ['electron', 'keytar', 'ws'],
    noExternal: ['get-port', 'uuid', 'zod', 'electron-store'],
    shims: true,
    treeshake: true,
  },
  // Shared modules - ESM (for BinaryDetector and other shared utilities)
  {
    entry: {
      'shared/BinaryDetector': 'src/shared/BinaryDetector.ts',
      'shared/ProxyConfig': 'src/shared/ProxyConfig.ts',
    },
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    splitting: false,
    sourcemap: true,
    clean: false,
    dts: false,
    outDir: 'dist',
    external: ['electron', 'keytar', 'ws'],
    shims: true,
    treeshake: true,
  },
  // Preload - MUST be CommonJS (Electron sandbox requirement)
  {
    entry: {
      'main/preload': 'src/main/preload.ts',
    },
    format: ['cjs'],
    target: 'node22',
    platform: 'node',
    splitting: false,
    sourcemap: true,
    clean: false,
    dts: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.cjs' }),
    external: ['electron'],
    shims: false,
    treeshake: false,
  },
]);
