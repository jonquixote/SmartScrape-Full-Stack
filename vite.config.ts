import build from '@hono/vite-build'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

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
        })
      ]
    }
  }
})
