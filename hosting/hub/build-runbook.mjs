// Renders a Markdown runbook into a page body for admin.zhiyuantech.ai. deploy-site.ps1 wraps
// the result with the same top bar, theme script and ZYT palette (sop-theme.css) as the SOP pages.
//   node hosting/hub/build-runbook.mjs <doc.md> <out.body.html> [kind, default Runbook]
//     [org, default "NCT Freight Forwarding"] [short org for the <title>, default NCT]
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// the article's rules live in runbook-body.css, shared with the dashboard's task view (plan §4.4)
const bodyCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'runbook-body.css'), 'utf8');
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
${bodyCss}/* the same button under the table of contents, when --download= is passed */
.rb-toc a.rb-toc-dl {
  display: flex; align-items: center; justify-content: center; gap: .45rem; margin-top: 1rem;
  font: 600 .85rem var(--rb-head); color: #fff; background: var(--accent);
  border: 1px solid transparent; border-radius: 10px; padding: .6rem .8rem; text-decoration: none;
  transition: filter .15s;
}
.rb-toc a.rb-toc-dl:hover { filter: brightness(1.12); color: #fff; text-decoration: none; }
/* dark theme softens --accent for text; the button keeps the solid brand indigo behind white */
:root[data-theme="dark"] .rb-toc a.rb-toc-dl { background: #4159c9; }
.rb-source { grid-column: 2; margin-top: 3rem; font-size: .78rem; color: var(--ink-faint); }
@media (max-width: 60rem) {
  .rb { grid-template-columns: minmax(0, 1fr); }
  .rb-toc { position: static; max-height: none; border-left: 0; padding-left: 0; padding-bottom: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--rule); }
  .rb-source { grid-column: 1; }
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
