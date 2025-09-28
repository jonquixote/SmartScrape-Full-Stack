import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <title>Crawl4AI Comprehensive Demo</title>
      </head>
      <body>{children}</body>
    </html>
  )
})