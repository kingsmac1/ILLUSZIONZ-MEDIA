// JSON (extract.mjs) -> TSX + CSS.  usage: node gen.mjs <extractedDir> <projectRoot>
import fs from 'fs';
import path from 'path';

const IN = process.argv[2];
const ROOT = process.argv[3];
const GEN = path.join(ROOT, 'src/generated');
fs.mkdirSync(GEN, { recursive: true });

const INHERITED = new Set(`color font-family font-size font-weight font-style line-height letter-spacing word-spacing text-transform text-align text-indent text-shadow white-space word-break overflow-wrap cursor list-style-type list-style-position visibility fill stroke stroke-width pointer-events direction text-overflow-x text-wrap font-kerning font-variant-ligatures`.split(/\s+/));
const SPECIAL_SKIP = new Set(['max-width-fallback']);
const SITE = 'https://illuszionzmedia.com';

// ---------- image localisation ----------
const imageMap = new Map(); // normalized original url -> local filename
const imageList = [];       // {file, urls:[]}
function localize(url) {
  if (!url) return url;
  if (!/^https?:\/\//.test(url)) return url;
  const u = new URL(url);
  if (!/illuszionzmedia\.com$/.test(u.hostname) && !/^(web\.)?illuszionzmedia/.test(u.hostname)) return url;
  if (!u.pathname.includes('/wp-content/uploads/')) return url;
  const rel = decodeURIComponent(u.pathname.split('/wp-content/uploads/')[1]);
  const orig = rel.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
  const base = path.basename(orig);
  let name = imageMap.get(orig);
  if (!name) {
    name = base.replace(/[^A-Za-z0-9._-]/g, '_');
    const taken = new Set(imageMap.values());
    if (taken.has(name)) name = orig.replace(/[\/]/g, '-').replace(/[^A-Za-z0-9._-]/g, '_');
    imageMap.set(orig, name);
    imageList.push({ file: name, orig: SITE + '/wp-content/uploads/' + orig, variant: url });
  }
  return '/images/' + name;
}
function localizeCssUrls(v) {
  return v.replace(/url\((["']?)(.*?)\1\)/g, (m, q, u) => `url("${localize(u)}")`);
}

// ---------- style reduction ----------
const cssEscapeNone = v => v;
function reduce(node, W, parentFull, defaultsAll, d) {
  // returns {prop:value} effective style for width key W
}

function buildStyles(content) {
  const { tree, styles, hover, defaults } = content;
  const idx = new Map(); // id -> {node,parent}
  (function index(n, p) { if (typeof n === 'string') return; idx.set(String(n.id), { node: n, parent: p }); for (const c of n.c) index(c, n); })(tree, null);
  const docDef = defaults['http://www.w3.org/1999/xhtml|div|'] || defaults['http://www.w3.org/1999/xhtml|div'] || {};
  docDefGlobal = docDef;
  const eff = { d: {}, t: {}, m: {} };
  for (const W of ['d', 't', 'm']) {
    const S = styles[W];
    for (const [id, full] of Object.entries(S)) {
      const ent = idx.get(id);
      if (!ent) continue;
      const n = ent.node;
      const ns = n.svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml';
      let def = defaults[ns + '|' + n.t + '|' + (n.t === 'input' ? (n.a.type || 'text') : '')] || defaults[ns + '|' + n.t] || docDef;
      if (n.t === 'a') def = { ...def, color: 'rgb(0, 0, 238)', 'text-decoration-line': 'underline', cursor: 'pointer' };
      const parentFull = ent.parent ? S[String(ent.parent.id)] : null;
      const out = {};
      for (const [p, v] of Object.entries(full)) {
        if (p.startsWith('::')) continue;
        if (p === 'width' || p === 'height') { out[p] = v; continue; }
        if (SPECIAL_SKIP.has(p) || p === 'caret-color') continue;
        // noise filters
        const bm = /^border-(top|right|bottom|left)-(color|width)$/.exec(p);
        if (bm && (full[`border-${bm[1]}-style`] === 'none' || full[`border-${bm[1]}-style`] === 'hidden')) continue;
        if (bm && v === def[p] && full[`border-${bm[1]}-style`] !== def[`border-${bm[1]}-style`]) { out[p] = v; continue; }
        if (bm || /^border-(top|right|bottom|left)-style$/.test(p)) { if (v !== def[p] || (bm && full[`border-${bm[1]}-style`] !== 'none')) { out[p] = v; } continue; }
        if ((p === 'outline-color' || p === 'outline-width') && full['outline-style'] === 'none') continue;
        if (p === 'text-decoration-color' && (full['text-decoration-line'] === 'none' || v === full['color'])) continue;
        if ((p === 'min-width' || p === 'min-height') && v === 'auto') continue;
        if (['top', 'right', 'bottom', 'left'].includes(p) && (full.position === 'static' || (full.position === 'relative' && v === '0px'))) continue;
        if (p === 'transition-duration' || p === 'transition-delay' || p === 'transition-timing-function') { if (full['transition-property'] === 'all' && /^0s/.test(full['transition-duration'])) continue; }
        if (INHERITED.has(p)) {
          let expected;
          if (def[p] !== undefined && def[p] !== docDef[p]) expected = def[p];
          else expected = parentFull ? parentFull[p] : docDef[p];
          if (v !== expected) out[p] = v;
        } else if (v !== def[p]) out[p] = v;
      }
      // tree root inherits the body's unitless 1.5 line-height (a px value here would be inherited as a fixed length)
      if (!ent.parent && out['line-height'] && Math.abs(parseFloat(out['line-height']) - parseFloat(full['font-size']) * 1.5) < 0.05) delete out['line-height'];
      // percentages inside a grid container refer to the grid area, not the container: turn them back into pixels
      if (typeof out.width === 'string' && /%$/.test(out.width) && parentFull && /grid/.test(parentFull.display) && parentFull['grid-template-columns']) {
        const tr = parentFull['grid-template-columns'].trim().split(/\s+/).filter(t => /px$/.test(t)).map(parseFloat);
        if (tr.length) {
          const gap = parseFloat(parentFull['column-gap']) || 0;
          const contentW = tr.reduce((a, b) => a + b, 0) + gap * (tr.length - 1);
          out.width = Math.round(parseFloat(out.width) / 100 * contentW * 100) / 100 + 'px';
          if (!out['max-width']) out['max-width'] = '100%';
        }
      }
      // fixed pixel widths on block-level boxes must never exceed their container (small phones)
      if (typeof out.width === 'string' && /^[\d.]+px$/.test(out.width) && parseFloat(out.width) >= 100 && /^(block|flex|grid)$/.test(full.display) && full.position !== 'absolute' && full.position !== 'fixed' && n.t !== 'img' && !n.svg) {
        out.width = `min(${out.width}, 100%)`;
      }
      // centred boxes (auto side margins) inside a column flex container shrink-wrap unless they fill the width
      if (out['margin-left'] === 'auto' && out['margin-right'] === 'auto' && out.width === undefined && parentFull && /flex/.test(parentFull.display) && /^column/.test(parentFull['flex-direction']) && full.position !== 'absolute') out.width = '100%';
      // absolutely positioned boxes: computed offsets are used values; keep the near edge only (unless the box stretches)
      if (full.position === 'absolute') {
        const num = k => (out[k] === undefined || out[k] === 'auto' ? null : parseFloat(out[k]));
        const L = num('left'), R = num('right'), T = num('top'), B = num('bottom');
        if (L !== null && R !== null && !(L <= 60 && R <= 60)) { if (L <= R) delete out.right; else delete out.left; }
        if (T !== null && B !== null && !(T <= 60 && B <= 60)) { if (T <= B) delete out.bottom; else delete out.top; }
      }
      // computed grid tracks are resolved pixel lists: rows must stay content-sized, columns become proportional
      if (typeof out['grid-template-rows'] === 'string' && /^(\d+(\.\d+)?px\s*)+$/.test(out['grid-template-rows'].trim())) {
        out['grid-template-rows'] = out['grid-template-rows'].trim().split(/\s+/).map(t => `minmax(${t}, auto)`).join(' ');
      } else delete out['grid-template-rows'];
      if (typeof out['grid-template-columns'] === 'string' && /^(\d+(\.\d+)?px\s*)+$/.test(out['grid-template-columns'].trim())) {
        out['grid-template-columns'] = out['grid-template-columns'].trim().split(/\s+/).map(t => `minmax(0, ${parseFloat(t)}fr)`).join(' ');
      }
      // a wrapping column flex container with a fixed height would wrap its items into extra columns on sub-pixel rounding
      if (full['flex-direction'] && full['flex-direction'].startsWith('column') && full['flex-wrap'] === 'wrap' && out.height) delete out.height;
      if (full['max-width-fallback'] && (!out['max-width'])) out['max-width'] = '100%';
      if (typeof out.width === 'string' && /^[\d.]+%$/.test(out.width)) { const pv = parseFloat(out.width); out.width = (pv >= 99.9 ? 100 : Math.floor(pv * 10) / 10) + '%'; }
      if (n.t === 'img' && out.height === undefined) out.height = 'auto';
      // pseudo
      for (const ps of ['::before', '::after']) if (full[ps]) out[ps] = full[ps];
      // links should not rely on UA blue; keep as emitted
      eff[W][id] = out;
    }
  }
  return { idx, eff, hover };
}

// ---------- CSS generation ----------
function decl(p, v) {
  let val = v;
  if (p === 'background-image') val = localizeCssUrls(v);
  return `${p}:${val}`;
}
function collapse(style) {
  // collapse margin/padding/border-radius longhands into shorthands when complete
  const s = { ...style };
  for (const base of ['margin', 'padding']) {
    const keys = ['top', 'right', 'bottom', 'left'].map(k => `${base}-${k}`);
    if (keys.every(k => k in s)) {
      const [t, r, b, l] = keys.map(k => s[k]);
      s[base] = t === b && r === l ? (t === r ? t : `${t} ${r}`) : `${t} ${r} ${b} ${l}`;
      keys.forEach(k => delete s[k]);
    }
  }
  const rk = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(k => `border-${k}-radius`);
  if (rk.every(k => k in s)) { const v = rk.map(k => s[k]); s['border-radius'] = v.every(x => x === v[0]) ? v[0] : v.join(' '); rk.forEach(k => delete s[k]); }
  return s;
}
function ruleBody(style) {
  const s = collapse(style);
  return Object.entries(s).filter(([p]) => !p.startsWith('::')).map(([p, v]) => decl(p, v)).join(';');
}

class ClassBank {
  constructor(prefix) { this.prefix = prefix; this.map = new Map(); this.rules = []; this.n = 0; }
  get(d, t, m, hov, pseudo, extra) {
    const key = JSON.stringify([d, t, m, hov, pseudo, extra]);
    if (this.map.has(key)) return this.map.get(key);
    const name = `${this.prefix}${++this.n}`;
    this.map.set(key, name);
    this.rules.push({ name, d, t, m, hov, pseudo, extra });
    return name;
  }
  css() {
    const base = [], tab = [], mob = [];
    for (const r of this.rules) {
      const sel = '.' + r.name;
      if (Object.keys(r.d).length) base.push(`${sel}{${ruleBody(r.d)}}`);
      if (r.hov && Object.keys(r.hov).length) base.push(`${sel}:hover{${Object.entries(r.hov).map(([p, v]) => decl(p, v)).join(';')}}`);
      if (r.extra) {
        const ex = r.extra;
        if (ex.focus && Object.keys(ex.focus).length) base.push(`${sel}:focus{${ruleBody(ex.focus)}}`);
        if (ex.checked && Object.keys(ex.checked).length) base.push(`${sel}:checked{${ruleBody(ex.checked)}}`);
        if (ex.checkedBefore && Object.keys(ex.checkedBefore).length) base.push(`${sel}:checked::before{${Object.entries(ex.checkedBefore).map(([p, v]) => p === 'content' ? `content:${v}` : decl(p, v)).join(';')}}`);
        if (ex.checkedAfter && Object.keys(ex.checkedAfter).length) base.push(`${sel}:checked::after{${Object.entries(ex.checkedAfter).map(([p, v]) => p === 'content' ? `content:${v}` : decl(p, v)).join(';')}}`);
        if (ex.placeholder) base.push(`${sel}::placeholder{color:${ex.placeholder.color};opacity:${ex.placeholder.opacity}}`);
      }
      const cleanPseudo = (o) => {
        if (!o) return o;
        const c = {};
        const stretch = o.position === 'absolute' && ['top', 'right', 'bottom', 'left'].every(k => parseFloat(o[k]) === 0);
        for (const [p, v] of Object.entries(o)) {
          if (['font-size', 'font-family', 'color', 'transition'].includes(p)) continue;
          if (stretch && (p === 'width' || p === 'height')) continue;
          if (['background-color'].includes(p) && v === 'rgba(0, 0, 0, 0)') continue;
          if (['background-image', 'transform', 'box-shadow'].includes(p) && v === 'none') continue;
          if (p === 'z-index' && v === 'auto') continue;
          if (p === 'mix-blend-mode' && v === 'normal') continue;
          if (/^margin-/.test(p) && v === '0px') continue;
          if (['border-radius', 'border-top-width'].includes(p) && v === '0px') continue;
          if (p === 'border-top-style' && v === 'none') continue;
          if (p === 'border-top-color' && o['border-top-style'] === 'none') continue;
          if (p === 'opacity' && v === '1') continue;
          if (p === 'background-size' && v === 'auto') continue;
          if (['top', 'right', 'bottom', 'left'].includes(p) && (v === 'auto' || (o.position === 'static'))) continue;
          if (p === 'position' && v === 'static') continue;
          c[p] = v;
        }
        if (o.position === 'absolute' && !stretch) {
          const num = k => (c[k] === undefined || c[k] === 'auto' ? null : parseFloat(c[k]));
          const L = num('left'), R = num('right'), T = num('top'), B = num('bottom');
          if (L !== null && R !== null) { if (L <= R) delete c.right; else delete c.left; }
          if (T !== null && B !== null) { if (T <= B) delete c.bottom; else delete c.top; }
        }
        return c;
      };
      for (const ps of ['::before', '::after']) {
        const pd = cleanPseudo(r.pseudo && r.pseudo.d && r.pseudo.d[ps]);
        if (pd) base.push(`${sel}${ps}{${Object.entries(pd).map(([p, v]) => p === 'content' ? `content:${v}` : decl(p, v)).join(';')}}`);
        const pm = cleanPseudo(r.pseudo && r.pseudo.m && r.pseudo.m[ps]);
        if (pm && pd) { const diff = Object.entries(pm).filter(([p, v]) => pd[p] !== v); if (diff.length) mob.push(`${sel}${ps}{${diff.map(([p, v]) => decl(p, v)).join(';')}}`); }
      }
      if (Object.keys(r.t).length) tab.push(`${sel}{${ruleBody(r.t)}}`);
      if (Object.keys(r.m).length) mob.push(`${sel}{${ruleBody(r.m)}}`);
    }
    let out = base.join('\n');
    if (tab.length) out += `\n@media (max-width:1024px){\n${tab.join('\n')}\n}`;
    if (mob.length) out += `\n@media (max-width:767px){\n${mob.join('\n')}\n}`;
    return out + '\n';
  }
}

// diff helpers for responsive overrides
let docDefGlobal = {};
function diffStyle(base, next, defFor) {
  const o = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
  for (const k of keys) {
    if (k.startsWith('::')) continue;
    if (base[k] !== next[k]) {
      if (next[k] !== undefined) o[k] = next[k];
      else if (INHERITED.has(k) && !(defFor[k] !== undefined && docDefGlobal[k] !== undefined && defFor[k] !== docDefGlobal[k])) o[k] = 'inherit';
      else o[k] = defFor[k] !== undefined ? defFor[k] : 'revert';
    }
  }
  return o;
}

// ---------- JSX generation ----------
const VOID = new Set(['img', 'br', 'hr', 'input', 'source', 'wbr']);
const SVG_ATTR = { 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'xlink:href': 'xlinkHref', 'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity', viewBox: 'viewBox', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'maxlength': 'maxLength', 'readonly': 'readOnly', 'autocomplete': 'autoComplete', 'colspan': 'colSpan', 'rowspan': 'rowSpan', 'allowfullscreen': 'allowFullScreen', 'frameborder': 'frameBorder', 'playsinline': 'playsInline', 'inputmode': 'inputMode', 'class': 'className' };
const BOOL = new Set(['required', 'checked', 'selected', 'disabled', 'readonly', 'multiple', 'controls', 'autoplay', 'muted', 'loop', 'allowfullscreen', 'playsinline']);

function esc(s) { return JSON.stringify(s); }
function textJsx(t) {
  if (/^[^{}<>&"\\]*$/.test(t) && t.trim() === t) return t;
  return `{${esc(t)}}`;
}
function internalHref(h) {
  if (!h) return h;
  if (h.startsWith(SITE)) { let r = h.slice(SITE.length) || '/'; return r; }
  if (h.startsWith('http://illuszionzmedia.com')) return h.slice('http://illuszionzmedia.com'.length) || '/';
  return h;
}

function genPage(content, opts) {
  const { prefix, specials = {}, rootGate } = opts;
  const { idx, eff, hover } = buildStyles(content);
  if (opts.stripRoot) for (const W of ['d', 't', 'm']) { const r = eff[W][String(content.tree.id)]; if (r) for (const p of opts.stripRoot) delete r[p]; }
  const bank = new ClassBank(prefix);
  const defaults = content.defaults;
  const dataBlocks = [];
  const imports = new Set();
  const usedIds = new Set();
  let galleryIdx = 0;
  const forced = new Set();

  function classFor(n) {
    const id = String(n.id);
    const d = eff.d[id] || {};
    const t0 = eff.t[id] || {};
    const m0 = eff.m[id] || {};
    const ns = n.svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml';
    const defFor = {};
    let dd = defaults[ns + '|' + n.t + '|' + (n.t === 'input' ? (n.a.type || 'text') : '')] || defaults[ns + '|' + n.t] || {};
    if (n.t === 'a') dd = { ...dd, color: 'rgb(0, 0, 238)', 'text-decoration-line': 'underline', cursor: 'pointer' };
    const t = diffStyle(d, t0, dd);
    const m = diffStyle(t0, m0, dd);
    const hov = hover[id] || null;
    const full = styles => styles;
    const pseudo = { d: {}, m: {} };
    const sd = content.styles.d[id], sm = content.styles.m[id];
    for (const ps of ['::before', '::after']) { if (sd && sd[ps]) pseudo.d[ps] = sd[ps]; if (sm && sm[ps]) pseudo.m[ps] = sm[ps]; }
    let extra = null;
    const st = content.states;
    if (st) {
      const f = st.focus && st.focus[id], c = st.checked && st.checked[id], ph = st.placeholder && st.placeholder[id];
      const cleanS = o => { const r = {}; for (const [k, v] of Object.entries(o || {})) { if (k === 'caret-color' || k.startsWith('transition') || k === 'outline-color' && o['outline-style'] === 'none') continue; r[k] = v; } return r; };
      if (f && Object.keys(f).length) extra = { ...(extra || {}), focus: cleanS(f) };
      if (c) {
        const cs = cleanS(c.s); if (Object.keys(cs).length) extra = { ...(extra || {}), checked: cs };
        if (c.before && Object.keys(c.before).length) extra = { ...(extra || {}), checkedBefore: c.before };
        if (c.after && Object.keys(c.after).length) extra = { ...(extra || {}), checkedAfter: c.after };
      }
      if (ph && ph.color) extra = { ...(extra || {}), placeholder: ph };
    }
    if (forced.has(id)) for (const dd2 of [d, t, m]) { if (dd2.display === 'none') delete dd2.display; }
    const has = Object.keys(d).length || Object.keys(t).length || Object.keys(m).length || hov || Object.keys(pseudo.d).length || extra;
    if (!has) return null;
    return bank.get(d, t, m, hov, pseudo, extra);
  }

  function isHiddenAll(n) {
    const id = String(n.id);
    return ['d', 't', 'm'].every(W => !eff[W][id] || eff[W][id].display === 'none');
  }
  function hiddenAllRaw(n) {
    const id = String(n.id);
    return ['d', 't', 'm'].every(W => { const s = content.styles[W][id]; return !s || s.display === 'none'; });
  }

  function attrs(n, cls, extra = {}) {
    const parts = [];
    if (cls) parts.push(`className="${cls}"`);
    for (const [k0, v0] of Object.entries(n.a)) {
      let k = k0, v = v0;
      if (['srcset', 'data-src', 'sizes', 'class', 'style'].includes(k)) continue;
      if (k === 'id' && !usedIds.has(v)) continue;
      if (k === 'src') { v = localize(v); }
      if (k === 'selected' && n.t === 'option') continue;
      if (k === 'checked') { parts.push('defaultChecked'); continue; }
      if (k === 'value' && ['input', 'textarea'].includes(n.t) && !['checkbox', 'radio', 'hidden', 'submit', 'button', 'reset'].includes(n.a.type || 'text')) { parts.push(`defaultValue=${esc(v)}`); continue; }
      if (k === 'href') { v = internalHref(v); }
      if (k === 'xmlns' || k === 'aria-errormessage' || k === 'aria-describedby') continue;
      if (k === 'loading' || k === 'decoding') continue;
      if (n.t === 'img' && (k === 'width' || k === 'height')) { parts.push(`${k}={${v}}`); continue; }
      const jk = SVG_ATTR[k] || k;
      if (n.t === 'select' && k === 'placeholder') continue;
      if (['tabIndex', 'maxLength', 'rows', 'cols', 'colSpan', 'rowSpan', 'size', 'min', 'max', 'step'].includes(jk) && /^-?\d+(\.\d+)?$/.test(v) && !(n.t === 'input' && ['min', 'max', 'step'].includes(jk) && ['date', 'time'].includes(n.a.type))) { parts.push(`${jk}={${Number(v)}}`); continue; }
      if (BOOL.has(k)) { parts.push(jk); continue; }
      if (k.startsWith('aria-') || k.startsWith('data-')) { parts.push(`${k}=${esc(v)}`); continue; }
      parts.push(`${jk}=${esc(v)}`);
    }
    for (const [k, v] of Object.entries(extra)) parts.push(`${k}=${v}`);
    return parts.length ? ' ' + parts.join(' ') : '';
  }

  function svgJsx(n, ind) {
    const a = Object.entries(n.a).filter(([k]) => k !== 'xmlns').map(([k, v]) => `${SVG_ATTR[k] || k}=${esc(v)}`).join(' ');
    if (!n.c.length) return `${ind}<${n.t}${a ? ' ' + a : ''} />`;
    return `${ind}<${n.t}${a ? ' ' + a : ''}>\n${n.c.map(c => typeof c === 'string' ? ind + '  ' + textJsx(c) : svgJsx(c, ind + '  ')).join('\n')}\n${ind}</${n.t}>`;
  }

  function isInline(n) {
    if (typeof n === 'string') return true;
    const s = content.styles.d[String(n.id)];
    return !s || s.display === 'inline' || s.display === 'inline-block' || s.display === 'inline-flex';
  }

  function render(n, ind, parentFlex, force) {
    if (typeof n === 'string') return null;
    if (opts.nodeHook && !force) {
      const hr = opts.nodeHook(n, ind, { classFor, imports, render: (x, i, f) => render(x, i, undefined, f), forced, hiddenAllRaw, localize });
      if (hr !== undefined && hr !== null) return hr;
    }
    if (hiddenAllRaw(n) && !force) return null;
    const id = String(n.id);
    // specials
    if (n.gallery) {
      const gname = `gallery${dataBlocks.length + 1}`;
      const items = n.gallery.map(g => ({ href: localize(g.href), thumb: localize(g.thumb || g.href), w: g.w, h: g.h, alt: g.title || g.alt || '' }));
      dataBlocks.push(`const ${gname} = ${JSON.stringify(items, null, 2)}`);
      imports.add('Gallery');
      const cls = classFor(n);
      const gs = (opts.gallerySettings || [])[galleryIdx++] || {};
      const colsA = [gs.columns || 3, gs.columns_tablet || 2, gs.columns_mobile || 1];
      const gap = gs.gap && gs.gap.size !== undefined ? gs.gap.size : 10;
      const pl = opts.placements ? ` placement={${JSON.stringify(opts.placements)}}` : '';
      return `${ind}<Gallery images={${gname}} columns={[${colsA.join(', ')}]} gap={${gap}}${pl}${cls ? ` className="${cls}"` : ''} />`;
    }
    if (n.swiperSettings && specials.slideshow) {
      const s = JSON.parse(n.swiperSettings);
      const gname = `slides${dataBlocks.length + 1}`;
      dataBlocks.push(`const ${gname} = ${JSON.stringify((s.background_slideshow_gallery || []).map(g => localize(g.url)), null, 2)}`);
      imports.add('BackgroundSlideshow');
      return `${ind}<BackgroundSlideshow images={${gname}} duration={${s.background_slideshow_slide_duration || 5000}} transition={${s.background_slideshow_transition_duration || 500}} />`;
    }
    if (n.w && specials[n.w]) {
      const r = specials[n.w](n, ind, { classFor, imports, render });
      if (r) return r;
    }
    if (n.svg) {
      const cls = classFor(n);
      const a = Object.entries(n.a).filter(([k]) => !['xmlns', 'class', 'style'].includes(k));
      const as = a.map(([k, v]) => `${SVG_ATTR[k] || k}=${esc(v)}`).join(' ');
      const inner = n.c.map(c => typeof c === 'string' ? '' : svgJsx(c, ind + '  ')).join('\n');
      return `${ind}<svg${cls ? ` className="${cls}"` : ''}${as ? ' ' + as : ''}>\n${inner}\n${ind}</svg>`;
    }
    const cls = classFor(n);
    const extra = {};
    if (n.t === 'select') { const so = n.c.find(o => typeof o !== 'string' && o.t === 'option' && 'selected' in o.a); if (so) extra.defaultValue = esc(so.a.value !== undefined ? so.a.value : so.c.filter(x => typeof x === 'string').join('').trim()); }
    if (n.t === 'a' && n.a.href && n.a.href.startsWith('#elementor-action')) {
      const act = decodeURIComponent(n.a.href.slice(1));
      if (act.includes('popup:open')) { extra.onClick = '{openMenu}'; extra['aria-label'] = '"Open menu"'; imports.add('__useMenu'); }
      else if (act.includes('popup:close')) { extra.onClick = '{closeMenu}'; extra['aria-label'] = '"Close menu"'; imports.add('__useMenu'); }
      n = { ...n, a: { ...n.a, href: '#' } };
    }
    if (n.t === 'a' && n.a.href) { n.a = { ...n.a, href: internalHref(n.a.href) }; }
    // collect children
    const kids = [];
    for (let i = 0; i < n.c.length; i++) {
      const c = n.c[i];
      if (typeof c === 'string') {
        const prev = n.c[i - 1], next = n.c[i + 1];
        let t = c.replace(/[ \t\r\n\f]+/g, ' ');
        const prevIn = prev === undefined ? false : isInline(prev), nextIn = next === undefined ? false : isInline(next);
        const preS = n.t === 'pre';
        if (/^[ \t\r\n\f]*$/.test(t)) { if (prevIn && nextIn && prev !== undefined && next !== undefined && typeof prev !== 'string' !== undefined) { kids.push({ text: ' ' }); } continue; }
        if (!prevIn || prev === undefined) t = t.replace(/^ /, '');
        if (!nextIn || next === undefined) t = t.replace(/ $/, '');
        kids.push({ text: t });
      } else {
        const r = render(c, ind + '  ');
        if (r) kids.push({ jsx: r });
      }
    }
    // trim spacing-only text at edges
    while (kids.length && kids[0].text === ' ') kids.shift();
    while (kids.length && kids[kids.length - 1].text === ' ') kids.pop();
    const tag = n.t;
    const at = attrs(n, cls, extra);
    if (VOID.has(tag)) return `${ind}<${tag}${at} />`;
    if (!kids.length) return tag === 'a' || tag === 'button' || tag === 'span' || tag === 'div' || tag === 'p' || tag.match(/^h\d$/) || tag === 'li' || tag === 'ul' || tag === 'section' || tag === 'i' ? `${ind}<${tag}${at}></${tag}>` : `${ind}<${tag}${at} />`;
    const simple = kids.every(k => k.text !== undefined);
    const jtag = tag === 'a' && n.a.href && (n.a.href.startsWith('/') && !n.a.href.startsWith('//')) && !extra.onClick ? 'A' : tag;
    if (jtag === 'A') imports.add('A');
    const attrStr = at;
    if (simple) {
      const joined = kids.map(k => k.text === ' ' ? '{" "}' : textJsx(k.text)).join('');
      return `${ind}<${jtag}${attrStr}>${joined}</${jtag}>`;
    }
    const body = kids.map(k => k.jsx !== undefined ? k.jsx : ind + '  ' + (k.text === ' ' ? '{" "}' : textJsx(k.text))).join('\n');
    return `${ind}<${jtag}${attrStr}>\n${body}\n${ind}</${jtag}>`;
  }

  // collect in-page anchor targets
  (function collect(n) { if (typeof n === 'string') return; if (n.a && n.a.href && n.a.href.startsWith('#') && n.a.href.length > 1 && !n.a.href.startsWith('#elementor')) usedIds.add(n.a.href.slice(1)); if (n.a && n.a.for) usedIds.add(n.a.for); n.c.forEach(collect); })(content.tree);

  const jsx = render(content.tree, '    ');
  return { jsx, css: bank.css(), dataBlocks, imports };
}

export { genPage, localize, imageList, GEN, ROOT, IN };
