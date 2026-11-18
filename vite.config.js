import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only the loopback HTTP development proxy needs non-Secure cookies.
// Production HTTPS responses are served by Nginx and are not changed here.
const backendProxy = () => ({
  target: process.env.DODAM_BACKEND_URL || 'http://127.0.0.1:8081',
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyRequest, request) => {
      const host = request.headers.host || '';
      // The browser calls this same-origin development server; forward that
      // origin as the upstream host, just as changeOrigin does for Host.
      if (/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)
          && request.headers.origin === `http://${host}`) {
        proxyRequest.setHeader('Origin', new URL(process.env.DODAM_BACKEND_URL || 'http://127.0.0.1:8081').origin);
      }
    });
    proxy.on('proxyRes', (response, request) => {
      const localHttp = !request.socket.encrypted && /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host || '');
      if (localHttp && response.headers['set-cookie']) {
        response.headers['set-cookie'] = response.headers['set-cookie'].map(cookie => cookie.replace(/;\s*Secure\b/gi, ''));
      }
    });
  },
});

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api/v1': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api': backendProxy(),
      '/oauth2': { target: 'http://127.0.0.1:8081', changeOrigin: true },
      '/login/oauth2': { target: 'http://127.0.0.1:8081', changeOrigin: true },
      '/logout': backendProxy(),
    },
  },
});

