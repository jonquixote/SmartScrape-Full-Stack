import build from '@hono/vite-build'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/node'
import { defineConfig } from 'vite'
import { copyFileSync } from 'fs'

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
          name: 'copy-main-index',
          closeBundle() {
            if (mode === 'production') {
              // Copy the main index.html file as the main index.html in dist
              copyFileSync('./index.html', './dist/index.html')
            }
          }
        }
      ]
    }
  }
})
