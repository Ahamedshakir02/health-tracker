import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: true },
  build: {
    // Source maps would publish the full readable source alongside a personal
    // health log. Keep them off for the deployed bundle.
    sourcemap: false,
    rollupOptions: {
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
