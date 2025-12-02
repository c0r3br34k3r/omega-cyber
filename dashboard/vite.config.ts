import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

/**
 * =============================================================================
 * OMEGA PLATFORM - DASHBOARD VITE CONFIGURATION
 * =============================================================================
 *
 * This file orchestrates the build and development environment for the Omega
 * Command Dashboard. It is written in TypeScript for type safety and uses
 * environment-aware configurations to optimize for both development speed and
 * production performance.
 *
 * --- Key Features ---
 * - SWC (Speedy Web Compiler) for fast HMR and builds.
 * - `tsconfig-paths` for automatic path alias resolution.
 * - API proxying to avoid CORS issues during development.
 * - Production build configured for advanced code splitting and chunking.
 * - Bundle visualizer for performance analysis.
 *
 */
export default defineConfig(({ command, mode }) => {
  // Load env variables from .env files based on the current mode.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // --- Plugins ---
    plugins: [
      // Use SWC for React compilation, which is significantly faster than Babel.
      react(),
      // Automatically resolves path aliases defined in tsconfig.json (e.g., `@/components`).
      tsconfigPaths(),
      // Generates a bundle analysis report when running `npm run bundle:analyze`.
      visualizer({
        open: mode === 'analyze',
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ],

    // --- Path Resolution ---
    resolve: {
      alias: {
        // Redundant with `vite-tsconfig-paths`, but serves as explicit documentation.
        '@': path.resolve(__dirname, './src'),
      },
      // In a complex monorepo, deduping ensures a single version of these libraries,
      // preventing bugs related to multiple instances.
      dedupe: ['react', 'react-dom', 'redux', 'react-redux', '@emotion/react'],
    },

    // --- Development Server Configuration ---
    server: {
      port: 3000,
      open: true, // Automatically open the browser on server start.
      // To enable local HTTPS:
      // 1. Run `npx mkcert create-ca` and `npx mkcert create-cert localhost`
      // 2. Uncomment the following lines:
      // https: {
      //   key: './localhost-key.pem',
      //   cert: './localhost.pem',
      // },
      proxy: {
        // Proxy API requests to the backend to avoid CORS issues.
        // All requests to `/api` will be forwarded to the Omega backend.
        '/api': {
          target: env.VITE_API_ENDPOINT || 'http://localhost:8080',
          changeOrigin: true,
          secure: false, // Set to true if backend has a self-signed cert.
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    // --- Production Build Configuration ---
    build: {
      outDir: 'dist',
      sourcemap: true, // 'hidden' is a good alternative for production.
      rollupOptions: {
        output: {
          /**
           * Advanced code splitting strategy. This separates large, rarely changing
           * vendor libraries from more frequently changing application code.
           * This significantly improves browser caching efficiency, as users won't
           * need to re-download these large libraries every time the app code changes.
           */
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor_react';
              if (id.includes('ag-grid')) return 'vendor_ag-grid';
              if (id.includes('echarts')) return 'vendor_echarts';
              if (id.includes('@mui')) return 'vendor_mui';
              // All other node_modules are grouped into a generic vendor chunk.
              return 'vendor';
            }
          },
        },
      },
    },

    // --- Preview Server Configuration ---
    preview: {
      port: 3001,
      host: true,
    },
  };
});