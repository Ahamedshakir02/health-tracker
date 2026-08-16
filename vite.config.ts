import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Absolute, not './'. The site now serves pages from more than one path
  // (/, /app, /privacy, /terms), and relative asset URLs resolve against the
  // *current* path — so /app/ with a trailing slash would look for
  // /app/assets/… and 404. Absolute paths are correct at every depth.
  base: '/',
  server: { port: 5173, host: true },
  build: {
    // Source maps would publish the full readable source alongside a personal
    // health log. Keep them off for the deployed bundle.
    sourcemap: false,
    rollupOptions: {
      // Five entries, two worlds. index/privacy/terms/404 are the public,
      // indexable, React-free pages; app.html is the tracker. They share only
      // the font files, so reading the marketing copy never downloads Firebase.
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        notFound: resolve(__dirname, '404.html'),
      },
      output: {
        // Firebase and Recharts are the two heavy deps; splitting them keeps the
        // app chunk small and lets the browser cache vendors across deploys.
        // Rolldown (Vite 8) only accepts the function form here — the object
        // form silently became a build error.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/]@?firebase/.test(id)) return 'firebase';
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-)/.test(id)) return 'charts';
        },
      },
    },
  },
});
