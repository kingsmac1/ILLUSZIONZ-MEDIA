import fs from 'fs'; import path from 'path';
import { genPage, imageList, GEN, ROOT, IN } from './gen.mjs';
const PAGES = [['home','Home'],['about-us','AboutUs'],['photography-services','PhotographyServices'],['wedding','Wedding'],['videography-services','VideographyServices'],['360-photo-booth','PhotoBooth360'],['academy','Academy'],['agency','Agency'],['careers','Careers'],['store','Store'],['contact','Contact'],['form','Form'],['media','Media'],['review','Review']];
const COMP = { CareersAccordion:'../components/CareersAccordion', FormShell:'../components/forms', ConditionalField:'../components/forms', ChoicesSelect:'../components/forms', TestimonialSlider:'../components/TestimonialSlider', MenuNav:'../components/MenuNav', Gallery:'../components/Gallery', BackgroundSlideshow:'../components/BackgroundSlideshow', A:'../components/A' };

const els = n => n.c.filter(c => typeof c !== 'string');
const txt = n => typeof n === 'string' ? n : n.c.map(txt).join('');
function findTag(n, tag) { if (typeof n === 'string') return null; if (n.t === tag) return n; for (const c of n.c) { const r = findTag(c, tag); if (r) return r; } return null; }
function chainTo(n, target, acc = []) { if (n === target) return [...acc, n]; if (typeof n === 'string') return null; for (const c of n.c) { const r = chainTo(c, target, [...acc, n]); if (r) return r; } return null; }
const htmlSpecial = (n, ind, ctx) => {
  const careers = (function f(x) { if (typeof x === 'string') return null; if ((' ' + (x.cl || '') + ' ').includes(' careers ')) return x; for (const k of x.c) { const r = f(k); if (r) return r; } return null; })(n);
  if (careers) {
    const items = els(careers).map(item => { const [header, content] = els(item); const [left] = els(header); const [h, meta] = els(left); return { title: txt(h).trim(), meta: txt(meta).trim(), text: txt(content).replace(/[ \t\r\n\f]+/g, ' ').trim(), ...((' ' + (item.cl || '') + ' ').includes(' active ') ? { open: true } : {}) }; });
    ctx.imports.add('CareersAccordion');
    const chain = chainTo(n, careers).slice(0, -1);
    let open = '', close = '';
    chain.forEach((c, i) => { const cl = ctx.classFor(c); open += `${ind}${'  '.repeat(i)}<div${cl ? ` className="${cl}"` : ''}>\n`; close = `${ind}${'  '.repeat(i)}</div>\n` + close; });
    const pad = ind + '  '.repeat(chain.length);
    return `${open}${pad}<CareersAccordion items={${JSON.stringify(items)}} />\n${close}`.replace(/\n$/, '');
  }
  if (!JSON.stringify(n).includes('❮')) return null;
  const section = findTag(n, 'section'); if (!section) return null;
  const container = els(section)[0]; const [content, controls, data] = els(container);
  const [q, a, r] = els(content); const [prev, next] = els(controls);
  const items = els(data).map(it => { const [p, h, sp] = els(it); return { quote: txt(p).trim(), author: txt(h).trim(), role: txt(sp).trim() }; });
  ctx.imports.add('TestimonialSlider');
  const cls = { section: ctx.classFor(section), container: ctx.classFor(container), content: ctx.classFor(content), quote: ctx.classFor(q), author: ctx.classFor(a), role: ctx.classFor(r), controls: ctx.classFor(controls), prev: ctx.classFor(prev), next: ctx.classFor(next) };
  const clsStr = JSON.stringify(Object.fromEntries(Object.entries(cls).filter(([, v]) => v)));
  const chain = chainTo(n, section).slice(0, -1);
  let open = '', close = '';
  chain.forEach((c, i) => { const cl = ctx.classFor(c); open += `${ind}${'  '.repeat(i)}<div${cl ? ` className="${cl}"` : ''}>\n`; close = `${ind}${'  '.repeat(i)}</div>\n` + close; });
  const pad = ind + '  '.repeat(chain.length);
  return `${open}${pad}<TestimonialSlider items={${JSON.stringify(items)}} cls={${clsStr}} />\n${close}`.replace(/\n$/, '');
};

const clOf = n => (typeof n === 'string' ? '' : (n.cl || ''));
const hasCl = (n, c) => (' ' + clOf(n) + ' ').includes(' ' + c + ' ');
function findCl(n, c) { if (typeof n === 'string') return null; if (hasCl(n, c)) return n; for (const k of n.c) { const r = findCl(k, c); if (r) return r; } return null; }
const textAll = n => typeof n === 'string' ? n : n.c.map(textAll).join('');
function makeFormHook(conditionsAll) {
  return (n, ind, ctx) => {
    if (typeof n === 'string') return undefined;
    if (n.t === 'form' && /wpforms-form-(\d+)/.test(n.a.id || '')) {
      const formId = /wpforms-form-(\d+)/.exec(n.a.id)[1];
      ctx.imports.add('FormShell');
      const kids = els(n).map(c => ctx.render(c, ind + '  ')).filter(Boolean).join('\n');
      const cond = conditionsAll[formId] || {};
      const fc = ctx.classFor(n);
      return `${ind}<FormShell formId="${formId}" formName="Form ${formId}" conditions={${JSON.stringify(cond)}}${fc ? ` formClassName="${fc}"` : ''}>\n${kids}\n${ind}</FormShell>`;
    }
    if (n.t === 'input' && n.a.type === 'hidden') return '';
    if (n.t === 'div' && /^wpforms-\d+-field_\d+-container$/.test(n.a.id || '')) {
      const lab = findCl(n, 'wpforms-field-label') || findCl(n, 'wpforms-field-label-inline');
      n.a['data-field'] = n.a.id; if (lab) n.a['data-label'] = textAll(lab).replace(/\s*\*\s*$/, '').trim();
      if (hasCl(n, 'wpforms-conditional-field')) {
        const fieldId = /field_(\d+)-container/.exec(n.a.id)[1];
        ctx.forced.add(String(n.id));
        ctx.imports.add('ConditionalField');
        return `${ind}<ConditionalField fieldId="${fieldId}">\n${ctx.render(n, ind + '  ', true)}\n${ind}</ConditionalField>`;
      }
    }
    if (n.t === 'div' && (n.a.role === 'listbox' || n.a.role === 'combobox') && hasCl(n, 'choices')) {
      const inner = els(n)[0], dropdown = els(n)[1];
      const sel = findTag(inner, 'select');
      const listS = findCl(inner, 'choices__list--single'); const item = listS && els(listS)[0];
      const dlist = dropdown && els(dropdown)[0];
      const optNodes = dlist ? els(dlist) : [];
      const options = optNodes.map(o => ({ value: hasCl(o, 'choices__placeholder') ? '' : textAll(o).trim(), label: textAll(o).trim(), ...(hasCl(o, 'choices__placeholder') ? { placeholder: true } : {}) }));
      const firstSel = optNodes.find(o => hasCl(o, 'choices__item--selectable'));
      const name = sel.a.name; const m = /\[(\d+)\]$/.exec(name || '');
      const cls = { root: ctx.classFor(n), inner: ctx.classFor(inner), list: listS && ctx.classFor(listS), item: item && ctx.classFor(item), dropdown: dropdown && ctx.classFor(dropdown), dropdownList: dlist && ctx.classFor(dlist), option: firstSel && ctx.classFor(firstSel) };
      ctx.imports.add('ChoicesSelect');
      const clsStr = JSON.stringify(Object.fromEntries(Object.entries(cls).filter(([, v]) => v)));
      return `${ind}<ChoicesSelect id="${sel.a.id}" name="${name}"${'required' in sel.a ? ' required' : ''}${m ? ` fieldId="${m[1]}"` : ''} options={${JSON.stringify(options)}} cls={${clsStr}} />`;
    }
    return undefined;
  };
}
function write(name, comp, c, opts) {
  const r = genPage(c, opts);
  const imps = [...r.imports].filter(i => COMP[i]).map(i => `import { ${i} } from '${COMP[i]}'`);
  const useMenu = r.imports.has('__useMenu');
  if (useMenu) imps.push(`import { useMenu } from '../components/MenuContext'`);
  const src = `${imps.join('\n')}\nimport './${name}.css'\n\n${r.dataBlocks.join('\n\n')}\n\nexport default function ${comp}() {\n${useMenu ? '  const { openMenu, closeMenu } = useMenu()\n' : ''}  return (\n${r.jsx}\n  )\n}\n`;
  fs.writeFileSync(path.join(GEN, comp + '.tsx'), src);
  fs.writeFileSync(path.join(GEN, name + '.css'), r.css);
  return r;
}
for (const [slug, comp] of PAGES) {
  const f = path.join(IN, slug + '.json'); if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f));
  const REFDIR = '/Users/macbook/Documents/Website Codes/ILLUSZIONZ MEDIA/My Site Reference/pages/';
  const rawHtml = fs.readFileSync(REFDIR + slug + '.html', 'utf8');
  const gallerySettings = [...rawHtml.matchAll(/data-settings="([^"]*gallery_layout[^"]*)"/g)].map(m => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
  const placements = JSON.parse(fs.readFileSync(path.join(path.dirname(IN.endsWith('/') ? IN.slice(0, -1) : IN), 'placements.json'), 'utf8'))[slug === 'home' ? '/' : '/' + slug + '/'] || null;
  const prefix = slug === '360-photo-booth' ? 'bth-' : slug.replace(/[^a-z0-9]/g,'').slice(0,3) + '-';
  const condM = /wpforms_conditional_logic\s*=\s*(\{.*?\});?\s*\n/.exec(rawHtml);
  const conditionsAll = condM ? JSON.parse(condM[1]) : {};
  write(slug, comp, d.content, { prefix, gallerySettings, placements, nodeHook: makeFormHook(conditionsAll), specials: { slideshow: true, 'html.default': htmlSpecial } });
  if (slug === 'home') {
    write('header', 'HeaderBar', d.header, { prefix: 'hd-', specials: {}, stripRoot: ['position','top','right','bottom','left','z-index','width','visibility'] });
    write('footer', 'FooterBar', d.footer, { prefix: 'ft-', specials: {} });
    write('popup', 'MenuPopupContent', d.popup, { prefix: 'pp-', specials: { 'nav-menu.default': (n, ind, ctx) => { ctx.imports.add('MenuNav'); const c = ctx.classFor(n); return `${ind}<div${c ? ` className="${c}"` : ''}><MenuNav /></div>`; } } });
    fs.writeFileSync(path.join(GEN, 'meta.json'), JSON.stringify({ body: d.bodyStyle, popup: d.popupModal }, null, 1));
  }
  if (slug === 'contact') {
    // the original form wrapper does not add its collapsed 24px margin to the card height (browser margin quirk) -> compensate
    const tsx = fs.readFileSync(path.join(GEN, comp + '.tsx'), 'utf8');
    const m = /<div className="([\w-]+)">\s*<div className="[\w-]+">\s*<FormShell/.exec(tsx);
    if (m) fs.appendFileSync(path.join(GEN, slug + '.css'), `.${m[1]}{margin-bottom:-24px}\n`);
  }
  console.log('gen', slug);
}
fs.writeFileSync(path.join(GEN, 'images.json'), JSON.stringify(imageList, null, 1));
console.log(imageList.length, 'images');
