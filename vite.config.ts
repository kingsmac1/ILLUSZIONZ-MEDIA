import fs from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pages = [
  '/', '/about-us/', '/photography-services/', '/wedding/', '/videography-services/',
  '/360-photo-booth/', '/academy/', '/agency/', '/careers/', '/store/', '/contact/', '/form/',
  '/media/', '/review/', '/dashboard/', '/blog/', '/blog/__post__/', '/gallery/__gallery__/',
].map((path) => ({ path }))

/** Serves functions/api/*.ts (Cloudflare Pages Functions) during `vite dev`, so forms work locally. */
function pagesFunctionsDev(mode: string): Plugin {
  const readVars = () => {
    const vars: Record<string, string> = { ...loadEnv(mode, process.cwd(), '') }
    try {
      for (const line of fs.readFileSync('.dev.vars', 'utf8').split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch {
      /* no .dev.vars */
    }
    return vars
  }
  return {
    name: 'pages-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const name = req.url.split('?')[0].replace('/api/', '')
          const mod = await server.ssrLoadModule(`/functions/api/${name}.ts`)
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const handler = mod[`onRequest${(req.method ?? 'GET').charAt(0) + (req.method ?? 'GET').slice(1).toLowerCase()}`] ?? mod.onRequest
          if (!handler) { res.statusCode = 405; res.end('Method not allowed'); return }
          const response: Response = await handler({ request, env: readVars() })
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Server error' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  server: { port: 3000 },
  plugins: [
    pagesFunctionsDev(mode),
    tailwindcss(),
    tanstackStart({
      // Static output for Cloudflare Pages: every page is pre-rendered to HTML (forms post to functions/api).
      pages,
      prerender: { enabled: true, crawlLinks: false, autoSubfolderIndex: true },
    }),
    viteReact(),
  ],
}))
