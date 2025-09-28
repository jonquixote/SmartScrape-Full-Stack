import build from '@hono/vite-build'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/node'
import { defineConfig } from 'vite'
import { copyFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        rollupOptions: {
          input: './src/renderer.tsx',
          output: {
            entryFileNames: 'static/client.js'
          }
        }
      }
    }
  } else {
    return {
      plugins: [
        build({
          entry: 'src/index.tsx'
        }),
        devServer({
          adapter,
          entry: 'src/index.tsx'
        }),
        {
          name: 'copy-comprehensive-ui',
          closeBundle() {
            // Copy public/index.html to dist/index.html
            try {
              copyFileSync('./public/index.html', './dist/index.html')
              console.log('Copied public/index.html to dist/index.html')
            } catch (error) {
              console.error('Error copying index.html:', error)
            }
          }
        },
        {
          name: 'serve-comprehensive-ui',
          configureServer(server) {
            // Serve public/index.html as the main page
            server.middlewares.use(async (req, res, next) => {
              if (req.url === '/' || req.url === '/index.html') {
                try {
                  const htmlContent = await readFile('./public/index.html', 'utf-8');
                  res.setHeader('Content-Type', 'text/html');
                  res.end(htmlContent);
                  return;
                } catch (error) {
                  console.error('Error reading index.html:', error);
                }
              }
              next();
            });
          }
        }
      ]
    }
  }
})
