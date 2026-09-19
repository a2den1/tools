import { defineConfig } from 'vite';

// 개발 서버에서도 api/*.js 를 Vercel 함수처럼 실행한다
const vercelApi = () => ({
  name: 'vercel-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url.match(/^\/api\/([\w-]+)(?:\?|$)/);
      if (!m) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
        await mod.default(req, res);
      } catch (e) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  },
});

export default defineConfig({
  plugins: [vercelApi()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  ssr: {
    external: ['youtubei.js', 'bgutils-js', 'jsdom'],
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
});
