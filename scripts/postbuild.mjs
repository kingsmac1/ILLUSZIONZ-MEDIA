// The blog is rendered at the edge (functions/blog). We prerender one shell per blog route type so the dehydrated router
// state matches what the client router expects, then move them out of /blog/ so the function owns those URLs.
import fs from 'node:fs'
const root = 'dist/client'
const move = (from, toDir) => {
  if (!fs.existsSync(`${root}/${from}`)) throw new Error(`postbuild: missing ${from} — was the blog shell prerendered?`)
  fs.mkdirSync(`${root}/${toDir}`, { recursive: true })
  fs.copyFileSync(`${root}/${from}`, `${root}/${toDir}/index.html`)
}
move('blog/index.html', '_shell/index')
move('blog/__post__/index.html', '_shell/post')
fs.rmSync(`${root}/blog`, { recursive: true, force: true })
fs.rmSync(`${root}/blog-shell`, { recursive: true, force: true })
console.log('postbuild: blog shells ready in _shell/')
