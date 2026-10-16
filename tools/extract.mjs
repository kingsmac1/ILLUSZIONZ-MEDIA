// Extracts a pruned DOM tree + computed styles (desktop/tablet/mobile) from the live site.
// usage: node extract.mjs <outDir>   -> writes <outDir>/<name>.json for each page + header/footer/popup
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://illuszionzmedia.com';
const PAGES = [
  ['home', '/'], ['about-us', '/about-us/'], ['photography-services', '/photography-services/'],
  ['wedding', '/wedding/'], ['videography-services', '/videography-services/'], ['360-photo-booth', '/360-photo-booth/'],
  ['academy', '/academy/'], ['agency', '/agency/'], ['careers', '/careers/'], ['store', '/store/'],
  ['contact', '/contact/'], ['form', '/form/'], ['media', '/media/'], ['review', '/review/'],
];
const WIDTHS = { d: 1440, t: 820, m: 390 };

const PROPS = `display position top right bottom left z-index float flex-direction flex-wrap justify-content align-items align-content align-self justify-self flex-grow flex-shrink flex-basis order row-gap column-gap grid-template-columns grid-template-rows grid-column-start grid-column-end grid-row-start grid-row-end grid-auto-flow grid-auto-columns grid-auto-rows margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top-width border-top-style border-top-color border-right-width border-right-style border-right-color border-bottom-width border-bottom-style border-bottom-color border-left-width border-left-style border-left-color border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius box-sizing min-width max-width min-height max-height background-color background-image background-size background-position background-repeat background-attachment background-clip color font-family font-size font-weight font-style line-height letter-spacing word-spacing text-transform text-align text-decoration-line text-decoration-color text-shadow text-indent text-overflow white-space word-break overflow-wrap overflow-x overflow-y opacity box-shadow transform transition-property transition-duration transition-timing-function transition-delay object-fit object-position aspect-ratio cursor list-style-type list-style-position vertical-align filter backdrop-filter mix-blend-mode fill stroke stroke-width visibility pointer-events clip-path direction -webkit-line-clamp -webkit-box-orient resize appearance outline-style outline-width outline-color clear border-collapse border-spacing table-layout font-stretch text-rendering font-feature-settings outline-offset column-count text-underline-offset text-decoration-thickness text-decoration-style hyphens justify-items text-wrap font-kerning font-variant-ligatures writing-mode grid-template-areas isolation`.split(/\s+/);

const browser = await chromium.launch();

// ---------- in-browser helpers (injected as string) ----------
const HELPERS = `
(() => {
  const PROPS = ${JSON.stringify(PROPS)};
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','LINK','META','TEMPLATE','TITLE']);
  const KEEP_ATTR = new Set(['href','target','rel','src','alt','title','type','name','placeholder','value','for','required','id','action','method','role','width','height','viewBox','xmlns','d','fill','fill-rule','clip-rule','cx','cy','r','x','y','x1','x2','y1','y2','points','transform','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','rows','cols','min','max','step','autocomplete','multiple','checked','selected','disabled','readonly','maxlength','inputmode','tabindex','aria-label','aria-hidden','aria-expanded','aria-haspopup','loading','decoding','colspan','rowspan','controls','autoplay','muted','loop','poster','preload','playsinline','allow','allowfullscreen','frameborder','data-id','xlink:href','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','rx','ry','width','height']);
  window.__gidv = window.__gidv || 0;
  const q = s => document.querySelector(s);
  function serializeRaw(el) {
    // raw svg subtree: tag + attrs + children
    const n = { t: el.localName, a: {}, c: [] };
    for (const at of el.attributes) { if (at.name === 'class' || at.name === 'style' || at.name.startsWith('data-')) continue; n.a[at.name] = at.value; }
    for (const ch of el.childNodes) {
      if (ch.nodeType === 1) n.c.push(serializeRaw(ch));
      else if (ch.nodeType === 3 && ch.textContent.trim()) n.c.push(ch.textContent);
    }
    return n;
  }
  function build(el) {
    if (el.nodeType !== 1 || SKIP.has(el.tagName)) return null;
    const tag = el.localName;
    const id = ++window.__gidv; el.setAttribute('data-gid', id);
    const node = { id, t: tag, a: {}, c: [] };
    if (typeof el.className === 'string' && el.className) node.cl = el.className.slice(0, 300);
    const wt = el.getAttribute('data-widget_type');
    if (wt) node.w = wt;
    for (const at of el.attributes) {
      if (KEEP_ATTR.has(at.name)) node.a[at.name] = at.value;
    }
    delete node.a['data-id'];
    if (tag === 'svg') { node.svg = true; node.c = [...el.children].map(serializeRaw); return node; }
    if (tag === 'img') {
      const ss = el.getAttribute('srcset');
      node.a.src = el.currentSrc || el.src;
      if (el.getAttribute('data-src')) node.a['data-src'] = el.getAttribute('data-src');
      if (ss) node.a.srcset = ss;
      node.nat = [el.naturalWidth, el.naturalHeight];
    }
    if (wt === 'gallery.default') {
      node.gallery = [...el.querySelectorAll('a.e-gallery-item')].map(a => {
        const im = a.querySelector('.e-gallery-image');
        return { href: a.getAttribute('href'), thumb: im ? (im.getAttribute('data-thumbnail') || '') : '', w: im ? +im.getAttribute('data-width') : 0, h: im ? +im.getAttribute('data-height') : 0, alt: a.getAttribute('aria-label') || '', title: a.getAttribute('data-elementor-lightbox-title') || '' };
      });
      return node;
    }
    if (el.classList.contains('swiper') || el.classList.contains('elementor-main-swiper')) {
      node.swiperHtml = el.outerHTML.slice(0, 20000);
      node.swiperSettings = el.closest('[data-settings]') ? el.closest('[data-settings]').getAttribute('data-settings') : null;
    }
    for (const ch of el.childNodes) {
      if (ch.nodeType === 3) { if (ch.textContent.length) node.c.push(ch.textContent); }
      else if (ch.nodeType === 1) { const b = build(ch); if (b) node.c.push(b); }
    }
    return node;
  }
  window.__build = (selector) => { const el = q(selector); if (!el) return null; return build(el); };

  // default computed style per (ns,tag)
  let frame;
  const defCache = {};
  function defaults(el) {
    const key = el.namespaceURI + '|' + el.localName + '|' + (el.localName === 'input' ? (el.getAttribute('type') || 'text') : '');
    if (defCache[key]) return defCache[key];
    if (!frame) {
      frame = document.createElement('iframe');
      frame.style.cssText = 'position:absolute;left:-9999px;top:0;width:1000px;height:800px;visibility:hidden;border:0';
      document.body.appendChild(frame);
      frame.contentDocument.open(); frame.contentDocument.write('<!doctype html><html><body></body></html>'); frame.contentDocument.close();
    }
    const d = frame.contentDocument;
    let host = d.body;
    let e;
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const svg = d.createElementNS(el.namespaceURI, 'svg'); host.appendChild(svg); e = el.localName === 'svg' ? svg : d.createElementNS(el.namespaceURI, el.localName); if (e !== svg) svg.appendChild(e);
    } else { e = d.createElement(el.localName); if (el.localName === 'input') e.setAttribute('type', el.getAttribute('type') || 'text'); if (el.localName === 'a') e.setAttribute('href', '#'); host.appendChild(e); }
    const cs = d.defaultView.getComputedStyle(e); const o = {};
    for (const p of PROPS) o[p] = cs.getPropertyValue(p);
    defCache[key] = o; return o;
  }
  window.__defaults = () => defCache;

  function probe(el, prop) {
    const r0 = el.getBoundingClientRect()[prop];
    const old = el.style.getPropertyValue(prop), pr = el.style.getPropertyPriority(prop);
    el.style.setProperty(prop, 'auto', 'important');
    const r1 = el.getBoundingClientRect()[prop];
    if (old) el.style.setProperty(prop, old, pr); else el.style.removeProperty(prop);
    return Math.abs(r0 - r1) < 0.6 ? null : r0;
  }
  const f = n => Math.round(n * 100) / 100;
  let natCache = new Map();
  function naturalH(ch) {
    const h0 = ch.style.getPropertyValue('height'), hp = ch.style.getPropertyPriority('height');
    const a0 = ch.style.getPropertyValue('align-self'), ap = ch.style.getPropertyPriority('align-self');
    ch.style.setProperty('height', 'auto', 'important'); ch.style.setProperty('align-self', 'flex-start', 'important');
    const v = ch.getBoundingClientRect().height;
    if (h0) ch.style.setProperty('height', h0, hp); else ch.style.removeProperty('height');
    if (a0) ch.style.setProperty('align-self', a0, ap); else ch.style.removeProperty('align-self');
    return v;
  }
  function readAll() {
    natCache = new Map();
    const out = {};
    for (const el of document.querySelectorAll('[data-gid]')) {
      const cs = getComputedStyle(el);
      defaults(el);
      const o = {};
      for (const p of PROPS) o[p] = cs.getPropertyValue(p);
      const parent = el.parentElement;
      const pcs = parent ? getComputedStyle(parent) : null;
      const disp = cs.display;
      const REPL = new Set(['svg','img','input','select','textarea','button','video','canvas','iframe']);
      if (disp !== 'none' && (disp !== 'inline' || REPL.has(el.localName)) && disp !== 'contents') {
        const r = el.getBoundingClientRect();
        const parentFlexRow = pcs && (pcs.display.includes('flex') && !pcs.flexDirection.startsWith('column') || pcs.display.includes('grid'));
        let pcw = 0;
        if (parent) pcw = parent.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
        if (el.localName === 'svg') {
          o['width'] = f(r.width) + 'px'; o['height'] = f(r.height) + 'px';
        } else {
          let w = probe(el, 'width');
          if (w === null && (el.localName === 'img' || ((disp === 'inline-block' || disp === 'inline-flex') && el.querySelector('img')))) w = r.width;
          if (w === null && parentFlexRow && parent && pcs.display.includes('flex') && cs.position !== 'absolute' && cs.position !== 'fixed' && !disp.startsWith('inline')) {
            // authored widths hide behind flex-shrink: an item narrower than its max-content has been squeezed by its width
            const o0 = el.style.getPropertyValue('width'), op = el.style.getPropertyPriority('width');
            el.style.setProperty('width', 'max-content', 'important');
            const mc = el.getBoundingClientRect().width;
            if (o0) el.style.setProperty('width', o0, op); else el.style.removeProperty('width');
            if (r.width < mc - 1.5) w = r.width;
          }
          if (w !== null && cs.boxSizing === 'content-box') {
            w -= parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
          }
          if (w !== null) {
            const pInline = (pcs && pcs.display.startsWith('inline')) || disp.startsWith('inline');
            const abs = cs.position === 'absolute' || cs.position === 'fixed';
            if (parentFlexRow && pcw > 0 && !pInline && !abs) o['width'] = f(w / pcw * 100) + '%';
            else if (el.localName === 'img' && pcw > 0 && !abs && w / pcw < 0.995 && parent.parentElement && (() => {
              const gp = parent.parentElement, gcs = getComputedStyle(gp);
              const gpw = gp.clientWidth - parseFloat(gcs.paddingLeft) - parseFloat(gcs.paddingRight);
              return Math.abs(parent.getBoundingClientRect().width - gpw) < 1.5;
            })()) o['width'] = f(w / pcw * 100) + '%';
            else { o['width'] = f(w) + 'px'; o['max-width-fallback'] = '100%'; }
          }
          let h = probe(el, 'height');
          if (h === null && parentFlexRow && parent && cs.position !== 'absolute' && cs.position !== 'fixed') {
            // authored heights hide behind flex/grid stretch: compare with the tallest natural sibling
            let nat = natCache.get(parent);
            if (nat === undefined) {
              nat = 0;
              for (const c of parent.children) { const cc = getComputedStyle(c); if (cc.display === 'none' || cc.position === 'absolute' || cc.position === 'fixed') continue; nat = Math.max(nat, naturalH(c)); }
              natCache.set(parent, nat);
            }
            if (r.height > nat + 0.5) h = r.height;
          }
          if (h !== null && cs.boxSizing === 'content-box') h -= parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
          if (h !== null) o['height'] = f(h) + 'px';
        }
        // auto margins detection (centered boxes)
        const ml = parseFloat(cs.marginLeft), mr = parseFloat(cs.marginRight);
        const inFlow = cs.position !== 'absolute' && cs.position !== 'fixed';
        if (inFlow && parent && ml > 0 && Math.abs(ml - mr) < 1 && cs.maxWidth !== 'none' && !parentFlexRow) { o['margin-left'] = 'auto'; o['margin-right'] = 'auto'; }
        else if (inFlow && parent && ml < 1 && (disp === 'block' || disp === 'flex' || disp === 'grid') && r.width < pcw - 2 && (pcs.display === 'block' || ((pcs.display.includes('grid') || pcs.display.includes('flex')) && [...parent.children].filter(c => { const cc = getComputedStyle(c); return cc.display !== 'none' && cc.position !== 'absolute' && cc.position !== 'fixed'; }).length === 1)) &&
                 Math.abs((r.left - (parent.getBoundingClientRect().left + parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth))) - (pcw - r.width) / 2) < 1.5 && (pcw - r.width) > 4) {
          o['margin-left'] = 'auto'; o['margin-right'] = 'auto';
        }
        else if (inFlow && parent && ml > 0 && Math.abs(ml - mr) < 1 && !parentFlexRow && (pcs.display.includes('flex') || pcs.display === 'block')) {
          // symmetrical margin from auto when element narrower than parent content
          if (cs.width !== 'auto' && Math.abs(r.width + ml + mr - pcw) < 1.5) { o['margin-left'] = 'auto'; o['margin-right'] = 'auto'; }
        }
      }
      if (cs.transform === 'none') delete o['transform-origin'];
      // pseudo elements
      for (const ps of ['::before', '::after']) {
        const pc = getComputedStyle(el, ps);
        if (pc.content && pc.content !== 'none' && pc.content !== 'normal' && pc.display !== 'none') {
          const po = { content: pc.content };
          for (const p of ['display','position','top','right','bottom','left','width','height','background-color','background-image','background-size','opacity','border-top-width','border-top-style','border-top-color','border-radius','transition','z-index','mix-blend-mode','color','font-size','font-family','transform','margin-top','margin-left','margin-right','margin-bottom']) po[p] = pc.getPropertyValue(p);
          o[ps] = po;
        }
      }
      out[el.getAttribute('data-gid')] = o;
    }
    return out;
  }
  window.__readAll = readAll;

  // hover rules
  window.__states = () => {
    const out = { focus: {}, checked: {}, placeholder: {} };
    const TP = PROPS.filter(p => !p.startsWith('transition'));
    const snap = (el, ps) => { const cs = getComputedStyle(el, ps); const o = {}; for (const p of (ps ? ['content','display','position','top','left','width','height','background-color','background-image','background-size','background-position','background-repeat','border-top-width','border-top-style','border-top-color','border-radius','transform','opacity','margin-top','margin-left','box-shadow'] : TP)) o[p] = cs.getPropertyValue(p); return o; };
    const diff = (a, b) => { const o = {}; for (const k of Object.keys(b)) if (a[k] !== b[k]) o[k] = b[k]; return o; };
    for (const el of document.querySelectorAll('[data-gid]')) {
      const gid = el.getAttribute('data-gid'); const tag = el.localName;
      if (['input','select','textarea','button','a'].includes(tag)) {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (tag === 'input' && ['hidden'].includes(type)) continue;
        const saved = el.getAttribute('style');
        el.style.setProperty('transition', 'none', 'important');
        const before = snap(el);
        if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
          const b4 = snap(el, '::before'), a4 = snap(el, '::after'); const was = el.checked;
          el.checked = true;
          out.checked[gid] = { s: diff(before, snap(el)), before: diff(b4, snap(el, '::before')), after: diff(a4, snap(el, '::after')) };
          el.checked = was;
        }
        try { el.focus({ preventScroll: true }); const d = diff(before, snap(el)); if (Object.keys(d).length) out.focus[gid] = d; el.blur(); } catch (e) {}
        if (saved === null) el.removeAttribute('style'); else el.setAttribute('style', saved);
        if (tag === 'input' || tag === 'textarea') { const pc = getComputedStyle(el, '::placeholder'); out.placeholder[gid] = { color: pc.color, opacity: pc.opacity }; }
      }
    }
    return out;
  };
  window.__hover = () => {
    const rules = [];
    const walk = (list) => { for (const r of list) {
      if (r.cssRules && r.type !== 1) { try { walk(r.cssRules); } catch(e){} }
      if (r.type === 1 && r.selectorText && r.selectorText.includes(':hover')) rules.push({ sel: r.selectorText, text: r.style.cssText, media: r.parentRule && r.parentRule.media ? r.parentRule.media.mediaText : '' });
    } };
    for (const ss of document.styleSheets) { try { walk(ss.cssRules); } catch (e) {} }
    const out = {};
    const SKIPP = new Set(['transition-property','transition-duration','transition-timing-function','transition-delay','width','height']);
    for (const el of document.querySelectorAll('[data-gid]')) {
      const gid = el.getAttribute('data-gid'); const decls = [];
      for (const r of rules) {
        if (r.media && !window.matchMedia(r.media).matches) continue;
        for (const part of r.sel.split(',')) {
          if (!part.includes(':hover')) continue;
          const p2 = part.trim();
          if (!/:hover(::[a-z-]+)?\\s*$/.test(p2) || /::/.test(p2)) continue;
          const base = p2.replace(/:hover/g, '');
          let ok = false; try { ok = el.matches(base); } catch (e) {}
          if (ok) { decls.push(r.text); break; }
        }
      }
      if (!decls.length) continue;
      const cs = getComputedStyle(el);
      const before = {}; for (const p of PROPS) before[p] = cs.getPropertyValue(p);
      const saved = el.getAttribute('style');
      el.style.setProperty('transition', 'none', 'important');
      for (const t of decls) for (const d of t.split(/;(?![^(]*\\))/)) {
        const k = d.indexOf(':'); if (k < 0) continue;
        const name = d.slice(0, k).trim(); let val = d.slice(k + 1).trim(); let imp = '';
        if (/!important$/.test(val)) { val = val.replace(/\\s*!important$/, ''); imp = 'important'; }
        if (name) el.style.setProperty(name, val, imp);
      }
      const acc = {};
      const cs2 = getComputedStyle(el);
      for (const p of PROPS) { if (SKIPP.has(p)) continue; const v = cs2.getPropertyValue(p); if (v !== before[p]) acc[p] = v; }
      if (saved === null) el.removeAttribute('style'); else el.setAttribute('style', saved);
      if (Object.keys(acc).length) out[gid] = acc;
    }
    return out;
  };
})();
`;

async function scrollAll(page) {
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h + 1500; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

async function extract(page, selector) {
  await page.evaluate(HELPERS);
  const tree = await page.evaluate(sel => window.__build(sel), selector);
  const styles = {};
  for (const [k, w] of Object.entries(WIDTHS)) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(900);
    styles[k] = await page.evaluate(() => window.__readAll());
    if (k === 'd') { /* hover collected at desktop */ }
  }
  await page.setViewportSize({ width: WIDTHS.d, height: 900 });
  await page.waitForTimeout(500);
  const hover = await page.evaluate(() => window.__hover());
  const defaults = await page.evaluate(() => window.__defaults());
  const states = await page.evaluate(() => window.__states());
  return { tree, styles, hover, defaults, states };
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, p] of PAGES) {
  if (ONLY && !ONLY.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await scrollAll(page);
    // stop carousels from moving
    const result = {};
    result.content = await extract(page, '[data-elementor-type="wp-page"]');
    if (name === 'home') {
      // header / footer
            const hdrSel = await page.evaluate(() => {
        const hs = [...document.querySelectorAll('header[data-elementor-type="header"] > .elementor-element')];
        const real = hs.find(h => !h.classList.contains('elementor-sticky__spacer')) || hs[0];
        real.setAttribute('data-hdr', '1'); return '[data-hdr="1"]';
      });
      result.header = await extract(page, hdrSel);
      result.footer = await extract(page, 'footer[data-elementor-type="footer"]');
      result.bodyStyle = await page.evaluate(() => { const cs = getComputedStyle(document.body); return { bg: cs.backgroundColor, color: cs.color, font: cs.fontFamily, size: cs.fontSize, lh: cs.lineHeight }; });
      // popup (menu)
      await page.locator('header a.elementor-icon[href*="popup"]').locator('visible=true').first().click();
      await page.waitForTimeout(1500);
      result.popup = await extract(page, '.elementor-location-popup');
      result.popupModal = await page.evaluate(() => { const m = document.querySelector('.elementor-popup-modal'); const cs = getComputedStyle(m); const c = m.querySelector('.dialog-widget-content'); const cc = getComputedStyle(c); return { bg: cs.backgroundColor, content: { w: cc.width, h: cc.height, bg: cc.backgroundColor, pos: cc.position, right: cc.right, top: cc.top } }; });
    }
    fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(result));
    console.log('ok', name);
  } catch (e) { console.log('FAIL', name, e.message.slice(0, 200)); }
  await ctx.close();
}
await browser.close();
