import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.VITE_PORT) || 5173;

function acvnApiPlugin() {
  let apiAppPromise: Promise<any> | null = null;
  const getApiApp = () => {
    if (!apiAppPromise) {
      apiAppPromise = import('./api/index.js').then((m) => m.app || m.default);
    }
    return apiAppPromise;
  };
  return {
    name: 'acvn-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api')) {
          const apiApp = await getApiApp();
          return apiApp(req, res, next);
        }
        next();
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api')) {
          const apiApp = await getApiApp();
          return apiApp(req, res, next);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    acvnApiPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: { overlay: false },
  },
});
