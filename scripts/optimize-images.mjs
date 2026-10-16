// One-off: recompress the big pictures in public/images in place (same file names, so every reference keeps working).
// Originals remain in "My Site Reference/". Re-running is safe: files that no longer shrink are left alone.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const dir = 'public/images'
let before = 0
let after = 0
for (const f of fs.readdirSync(dir)) {
  const ext = path.extname(f).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue
  const file = path.join(dir, f)
  const size = fs.statSync(file).size
  before += size
  if (size < 110_000) { after += size; continue }
  const img = sharp(file, { failOn: 'none' }).rotate().resize({ width: 2000, withoutEnlargement: true })
  const out = ext === '.png' ? await img.png({ compressionLevel: 9, palette: false }).toBuffer() : ext === '.webp' ? await img.webp({ quality: 78, effort: 5 }).toBuffer() : await img.jpeg({ quality: 78, mozjpeg: true, progressive: true }).toBuffer()
  if (out.length < size * 0.92) { fs.writeFileSync(file, out); after += out.length; console.log(`${f}: ${(size / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB`) } else after += size
}
console.log(`total ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`)
