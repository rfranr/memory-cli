import { defineConfig, type Plugin } from 'vite';

// Experimental files remain private in development and preview.
function privateExperiments(): Plugin {
  const middleware = (request: { url?: string }, response: { statusCode: number; end(): void }, next: () => void) => {
    let path: string;
    try { path = decodeURIComponent(request.url ?? '').replaceAll('\\', '/'); }
    catch { response.statusCode = 400; response.end(); return; }
    if (path.split(/[/?#]/).includes('experiments')) { response.statusCode = 403; response.end(); return; }
    next();
  };
  return {
    name: 'private-experiments',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
export default defineConfig({
  base: './',
  plugins: [privateExperiments()],
  server: { fs: { deny: ['**/experiments/**', '.env', '.env.*', '*.{crt,pem}', '**/.git/**'] } },
  build: { rollupOptions: { input: { main: 'index.html' } } },
});
