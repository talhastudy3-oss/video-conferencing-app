import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Binds to 0.0.0.0 instead of just localhost, so another device on
    // the same Wi-Fi/LAN can reach this dev server via this machine's IP.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.IO's handshake starts as HTTP then upgrades to a
      // WebSocket — ws:true lets the proxy forward that upgrade too.
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
