import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on both IPv4 (0.0.0.0) and IPv6 (::). Without `host: true`,
    // Vite only binds to localhost which on some Windows setups means
    // IPv6-only ([::1]) and `http://localhost:5173` is unreachable from
    // tools that prefer IPv4. `host: true` listens on all interfaces.
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
