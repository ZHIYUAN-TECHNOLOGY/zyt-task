// Renders a Markdown runbook into a page body for admin.zhiyuantech.ai. deploy-site.ps1 wraps
// the result with the same top bar, theme script and ZYT palette (sop-theme.css) as the SOP pages.
//   node hosting/hub/build-runbook.mjs <doc.md> <out.body.html> [kind, default Runbook]
//     [org, default "NCT Freight Forwarding"] [short org for the <title>, default NCT]
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Marked } from 'marked';

const argv = process.argv.slice(2);
// Optional: --download=/nct/downloads/<file>.zip puts a download button under the page's
// table of contents. deploy-site.ps1 passes it for pages that have a bundle.
const download = (argv.find((a) => a.startsWith('--download=')) || '').slice('--download='.length);
const [src, out, kind = 'Runbook', org = 'NCT Freight Forwarding', orgShort = 'NCT'] = argv.filter((a) => !a.startsWith('--'));
const kicker = `${org} · ${kind}`;
if (!src || !out) throw new Error('usage: node build-runbook.mjs <runbook.md> <out.body.html>');

const md = readFileSync(src, 'utf8');
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// stable, unique heading ids so sections can be linked
const used = new Map();
function slug(html) {
  const base = html
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'section';
  const n = used.get(base) || 0;
  used.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

const toc = [];
let title = null;
const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const id = slug(inner);
      if (depth === 1 && !title) title = inner.replace(/<[^>]+>/g, '');
      if (depth === 2) toc.push({ id, inner });
      const anchor = depth > 1 ? `<a class="rb-anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
      return `<h${depth} id="${id}">${anchor}${inner}</h${depth}>\n`;
    },
  },
});

let html = marked.parse(md);
// wide tables scroll inside their own box instead of widening the page
html = html.replace(/<table>/g, '<div class="rb-table"><table>').replace(/<\/table>/g, '</table></div>');

const updated = statSync(src).mtime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
// Drop repeated parts, e.g. "ZYT commands · ZYT · ZYT" -> "ZYT commands".
const titleParts = [title || basename(src, '.md'), orgShort, 'ZYT'];
const pageTitle = titleParts.filter((p, i) => p && !titleParts.slice(0, i).some((q) => q && q.toLowerCase().includes(p.toLowerCase()))).join(' · ');

const css = `
body { margin: 0; background: var(--ground); }
.rb {
  --rb-head: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  --rb-body: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --rb-mono: "JetBrains Mono", Consolas, monospace;
  max-width: 80rem; margin: 0 auto; padding: 2rem 1.25rem 5rem;
  display: grid; grid-template-columns: 15rem minmax(0, 1fr); gap: 0 3rem;
  color: var(--ink-soft); font: 15px/1.65 var(--rb-body);
}
.rb-kicker { grid-column: 1 / -1; margin: 0 0 1.25rem; font: 500 .72rem var(--rb-body); letter-spacing: .17em; text-transform: uppercase; color: var(--accent); }
.rb-toc {
  position: sticky; top: calc(3.75rem + 1.5rem); align-self: start;
  max-height: calc(100vh - 7rem); overflow-y: auto;
  border-left: 1px solid var(--rule); padding-left: 1rem; font-size: .85rem;
}
.rb-toc b { display: block; margin-bottom: .6rem; font: 600 .8rem var(--rb-head); color: var(--ink); }
.rb-toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .4rem; }
.rb-toc a { color: var(--ink-soft); text-decoration: none; line-height: 1.35; display: block; }
.rb-toc a:hover { color: var(--accent); }
.rb-toc code { font: .8em var(--rb-mono); }
.rb-body { min-width: 0; max-width: 54rem; }
.rb-body h1 { margin: 0 0 1rem; font: 700 clamp(1.8rem, 3.5vw, 2.5rem)/1.15 var(--rb-head); letter-spacing: -.03em; color: var(--ink); }
.rb-body h2 { margin: 2.6rem 0 .8rem; padding-top: 1.3rem; border-top: 1px solid var(--rule); font: 600 1.45rem/1.25 var(--rb-head); letter-spacing: -.02em; color: var(--ink); }
.rb-body h3 { margin: 1.9rem 0 .6rem; font: 600 1.12rem/1.3 var(--rb-head); color: var(--ink); }
.rb-body h4 { margin: 1.5rem 0 .5rem; font: 600 .98rem var(--rb-head); color: var(--ink); }
.rb-body h2, .rb-body h3, .rb-body h4 { position: relative; scroll-margin-top: calc(3.75rem + 1rem); }
.rb-anchor { position: absolute; left: -1.2em; color: var(--ink-faint); text-decoration: none; opacity: 0; transition: opacity .15s; }
.rb-body h2:hover .rb-anchor, .rb-body h3:hover .rb-anchor, .rb-body h4:hover .rb-anchor, .rb-anchor:focus-visible { opacity: 1; }
.rb-body p, .rb-body li { color: var(--ink-soft); }
.rb-body strong { color: var(--ink); }
.rb-body a { color: var(--accent); }
.rb-body ul, .rb-body ol { padding-left: 1.3rem; }
.rb-body li + li { margin-top: .25rem; }
.rb-body code { font: .85em var(--rb-mono); background: var(--surface-sunk); border: 1px solid var(--rule); border-radius: 6px; padding: .05em .35em; overflow-wrap: anywhere; }
.rb-body pre { margin: 1rem 0; background: var(--surface); border: 1px solid var(--rule); border-radius: 12px; padding: .9rem 1rem; overflow-x: auto; }
.rb-body pre code { background: none; border: 0; padding: 0; font-size: .82rem; white-space: pre; overflow-wrap: normal; }
.rb-table { margin: 1rem 0; overflow-x: auto; border: 1px solid var(--rule); border-radius: 12px; }
.rb-body table { border-collapse: collapse; width: 100%; font-size: .88rem; }
.rb-body th, .rb-body td { text-align: left; vertical-align: top; padding: .55rem .75rem; border-bottom: 1px solid var(--rule); }
.rb-body th { background: var(--surface); color: var(--ink); font-weight: 600; white-space: nowrap; }
.rb-body tr:last-child td { border-bottom: 0; }
.rb-body blockquote { margin: 1rem 0; padding: .6rem 1rem; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 10px 10px 0; }
.rb-body blockquote p { margin: .3rem 0; }
.rb-body hr { border: 0; border-top: 1px solid var(--rule); margin: 2rem 0; }
.rb-body hr:has(+ h2) { display: none; } /* h2 already draws its own rule */
/* the same button under the table of contents, when --download= is passed */
.rb-toc a.rb-toc-dl {
  display: flex; align-items: center; justify-content: center; gap: .45rem; margin-top: 1rem;
  font: 600 .85rem var(--rb-head); color: #fff; background: var(--accent);
  border: 1px solid transparent; border-radius: 10px; padding: .6rem .8rem; text-decoration: none;
  transition: filter .15s;
}
.rb-toc a.rb-toc-dl:hover { filter: brightness(1.12); color: #fff; text-decoration: none; }
/* dark theme softens --accent for text; the button keeps the solid brand indigo behind white */
:root[data-theme="dark"] .rb-toc a.rb-toc-dl { background: #4159c9; }
/* <a class="rb-dl"> in the markdown: a download button, e.g. under a table of plans */
.rb-body .rb-dl {
  display: inline-flex; align-items: center; gap: .5rem; margin: .25rem 0 1.25rem;
  font: 600 .9rem var(--rb-head); color: var(--ink); background: var(--surface);
  border: 1px solid var(--rule); border-radius: 12px; padding: .6rem 1rem; text-decoration: none;
}
.rb-body .rb-dl:hover { border-color: var(--accent); color: var(--accent); }
.rb-body .rb-dl small { font: 400 .78rem var(--rb-body); color: var(--ink-faint); }
.rb-source { grid-column: 2; margin-top: 3rem; font-size: .78rem; color: var(--ink-faint); }
@media (max-width: 60rem) {
  .rb { grid-template-columns: minmax(0, 1fr); }
  .rb-toc { position: static; max-height: none; border-left: 0; padding-left: 0; padding-bottom: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--rule); }
  .rb-source { grid-column: 1; }
  .rb-anchor { display: none; }
}
@media print { .rb { display: block; } .rb-toc { display: none; } }
`;

const body = `<title>${escapeHtml(pageTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>${css}</style>
<div class="rb">
  <p class="rb-kicker">${escapeHtml(kicker)}</p>
  <nav class="rb-toc" aria-label="On this page"><b>On this page</b><ol>${toc.map((t) => `<li><a href="#${t.id}">${t.inner}</a></li>`).join('')}</ol>${
    download ? `<a class="rb-toc-dl" href="${escapeHtml(download)}" download>&#x2913; Download plans</a>` : ''
  }</nav>
  <article class="rb-body">
${html}
  </article>
  <p class="rb-source">Source: <code>${escapeHtml(basename(src))}</code> · last edited ${updated}</p>
</div>
`;

writeFileSync(out, body);
console.log(`${kind.toLowerCase()}: ${basename(src)} -> ${toc.length} sections, ${(body.length / 1024).toFixed(0)} KB`);
