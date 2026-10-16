import { chromium } from 'playwright';
const [pg, width, maxn] = [process.argv[2] || '/', +(process.argv[3] || 1440), +(process.argv[4] || 25)];
const grab = async (b, url) => {
  const p = await (await b.newContext({ viewport: { width, height: 900 } })).newPage();
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(1000);
  return p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const el = n.parentElement; if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || b.y + scrollY < 0) continue;
      const cs = getComputedStyle(el);
      out.push({ t: t.slice(0, 40), x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height), fs: cs.fontSize, ff: cs.fontFamily.split(',')[0], fw: cs.fontWeight, c: cs.color });
    }
    return out;
  });
};
const b = await chromium.launch();
const A = await grab(b, 'https://illuszionzmedia.com' + pg), B = await grab(b, 'http://localhost:3000' + pg);
console.log('text nodes', A.length, B.length);
let shown = 0;
for (let i = 0; i < Math.min(A.length, B.length) && shown < maxn; i++) {
  const a = A[i], c = B[i];
  const bad = a.t !== c.t || Math.abs(a.x - c.x) > 2 || Math.abs(a.y - c.y) > 3 || Math.abs(a.w - c.w) > 3 || a.fs !== c.fs || a.fw !== c.fw || a.ff !== c.ff || a.c !== c.c;
  if (bad) { shown++; console.log(i, JSON.stringify(a), '\n  ', JSON.stringify(c)); }
}
await b.close();
