import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const OUT = process.argv[2]; const base = process.argv[3] || 'http://localhost:3000';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const pages = {home:'/', 'about-us':'/about-us/','photography-services':'/photography-services/',wedding:'/wedding/','videography-services':'/videography-services/','360-photo-booth':'/360-photo-booth/',academy:'/academy/',agency:'/agency/',careers:'/careers/',store:'/store/',contact:'/contact/',form:'/form/',media:'/media/',review:'/review/'};
fs.mkdirSync(OUT,{recursive:true});
const b = await chromium.launch();
for (const w of [1440,390]) {
  const ctx = await b.newContext({viewport:{width:w,height:w>500?900:844}}); const p = await ctx.newPage();
  for (const [n,u] of Object.entries(pages)) {
    if (only && !only.includes(n)) continue;
    try {
      await p.goto(base+u,{waitUntil:'networkidle',timeout:60000});
      await p.waitForTimeout(1200);
      await p.evaluate(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h+1500;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,250));}window.scrollTo(0,0);});
      await p.waitForTimeout(2500);
      await p.screenshot({path:path.join(OUT,`${n}-${w}.png`),fullPage:true});
    } catch(e){ console.log('FAIL',n,w,e.message.slice(0,80)); }
  }
  await ctx.close();
}
await b.close();
