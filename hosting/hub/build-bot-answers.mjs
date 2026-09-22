// Builds the Harper "What the bot answers" page source from the bot's own knowledge base, so the
// page can never drift from what the bot says. deploy-site.ps1 renders the output with
// build-runbook.mjs like any other Markdown page.
//   node hosting/hub/build-bot-answers.mjs <kb.md> <other-flows.md> <out.md>
// kb.md entries look like:
//   ## <section>
//   1. Q: <ms> / <en> / <zh>
//      A: ms: <text> | en: <text> | zh: <text>
import { readFileSync, writeFileSync } from 'node:fs';

const [kbPath, extraPath, out] = process.argv.slice(2);
if (!kbPath || !extraPath || !out) throw new Error('usage: node build-bot-answers.mjs <kb.md> <other-flows.md> <out.md>');

const SECTION_TITLES = { directions: 'Getting here', facilities: 'Facilities', front_desk: 'Front desk', policy: 'Policies' };
const LANGS = [['en', 'English'], ['ms', 'Malay'], ['zh', 'Chinese']];
const cell = (s) => s.replace(/\|/g, '\\|').trim();

const sections = [];
let entry = null;
for (const line of readFileSync(kbPath, 'utf8').split(/\r?\n/)) {
  const sec = /^##\s+(\S+)/.exec(line);
  if (sec) { sections.push({ key: sec[1], entries: [] }); continue; }
  const q = /^\s*(\d+)\.\s+Q:\s*(.+)$/.exec(line);
  if (q) {
    if (!sections.length) throw new Error(`kb.md: entry ${q[1]} is outside a ## section`);
    const [ms, en, zh] = q[2].split(' / ').map((s) => s.trim());
    entry = { n: Number(q[1]), q: { ms, en, zh }, a: null };
    sections[sections.length - 1].entries.push(entry);
    continue;
  }
  const a = /^\s*A:\s*(.+)$/.exec(line);
  if (a && entry) {
    entry.a = {};
    for (const part of a[1].split(' | ')) {
      const m = /^(ms|en|zh):\s*([\s\S]+)$/.exec(part.trim());
      if (m) entry.a[m[1]] = m[2];
    }
  }
}

const all = sections.flatMap((s) => s.entries);
if (!all.length) throw new Error('kb.md: no entries found');
for (const e of all) {
  for (const [l] of LANGS) {
    if (!e.q[l]) throw new Error(`kb.md entry ${e.n}: no ${l} question`);
    if (!e.a || !e.a[l]) throw new Error(`kb.md entry ${e.n}: no ${l} answer`);
  }
}

let md = `# What the bot answers

Every question the Harper concierge answers on WhatsApp, and the reply the guest gets. The bot
replies in the language the guest writes in (Malay, English or Chinese) and answers only from
this list. A guest does not have to use these exact words: the bot understands the question
however it is typed.

**Anything not on this page** gets "a colleague will follow up", and the bot never states a price.
The last section covers messages that are not questions: bookings, requests, complaints, photos
and STOP.

This page is built from the bot's knowledge base (\`OpenWA/kapso/prompt/kb.md\`, ${all.length} entries),
so it always shows what the bot says today.

`;

for (const s of sections) {
  md += `## ${SECTION_TITLES[s.key] || s.key}\n\n`;
  for (const e of s.entries) {
    md += `### ${e.q.en}\n\n| | Guest asks | Bot replies |\n|---|---|---|\n`;
    for (const [l, name] of LANGS) md += `| ${name} | ${cell(e.q[l])} | ${cell(e.a[l])} |\n`;
    md += '\n';
  }
}

md += readFileSync(extraPath, 'utf8').trim() + '\n';
writeFileSync(out, md);
console.log(`bot answers: ${all.length} knowledge-base entries in ${sections.length} sections`);
