import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { BASE_PATH } from './lib/site.mjs';
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { watch: { useFsEvents: false, usePolling: true } },
  plugins: [
    {
      name: 'billbook-development-entry-rewrites',
      apply: 'serve',
      enforce: 'pre',
      configureServer(server) {
        // Vite's base middleware redirects / before Next rewrites can run.
        // Rewrite entry aliases ahead of it, keeping the browser URL intact.
        server.middlewares.use((request, _response, next) => {
          const url = new URL(request.url || '/', 'http://localhost');
          if (
            ['/', '/index.html', BASE_PATH, `${BASE_PATH}/index.html`].includes(
              url.pathname,
            )
          ) {
            request.url = `${BASE_PATH}/${url.search}`;
            // The RSC dev adapter restores Connect's originalUrl before rendering.
            request.originalUrl = request.url;
          }
          next();
        });
      },
    },
    vinext(),
  ],
});
