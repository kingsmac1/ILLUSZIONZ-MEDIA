// Tiny static file server for the production build (dist/client). Usage: node scripts/serve.mjs [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/client')
const port = Number(process.argv[2] || process.env.PORT || 4173)
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain',
}

http
  .createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    let file = path.join(root, decodeURIComponent(url.pathname))
    if (!file.startsWith(root)) { res.writeHead(403).end(); return }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return }
      file = path.join(file, 'index.html')
    }
    if (!fs.existsSync(file)) {
      const notFound = path.join(root, '404.html')
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`Serving dist/client on http://localhost:${port}`))
