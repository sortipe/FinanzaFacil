import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        proxy: {
          '/api': {
            target: 'http://localhost:5555',
            changeOrigin: true,
          },
          '/consultar-dni': { target: 'http://localhost:5555', changeOrigin: true },
          '/consultar-ruc': { target: 'http://localhost:5555', changeOrigin: true },
          '/emitir-factura': { target: 'http://localhost:5555', changeOrigin: true },
          '/consultar-cpe': { target: 'http://localhost:5555', changeOrigin: true },
          '/verificar-conexion': { target: 'http://localhost:5555', changeOrigin: true },
          '/analizar-recibo': { target: 'http://localhost:5555', changeOrigin: true },
          '/status': { target: 'http://localhost:5555', changeOrigin: true }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
