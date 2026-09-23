// Copy the runner's saved golden-path recordings into hosting/recordings/, the
// TRACKED folder deploy-site.ps1 publishes at /golden-paths/ on the site.
//
//   node hosting/runner/publish-recordings.mjs          passed runs only
//   node hosting/runner/publish-recordings.mjs --all    failed runs too
//
// Then commit hosting/recordings/ and deploy. The site is PUBLIC: these videos
// show only the throwaway e2e orgs ("E2E …" names, example.invalid addresses),
// the same app screens the SOP pages already publish as screenshots — never
// point the runner at a database with real customers in it.
//
// A journey with several people has one clip per person: <job>-<n>.mp4, and
// the JSON lists them with the role whose screen each one is.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, 'runs');
const OUT = join(HERE, '..', 'recordings');
const all = process.argv.includes('--all');

mkdirSync(OUT, { recursive: true });
if (!existsSync(RUNS)) { console.log('nothing saved yet in', RUNS); process.exit(0); }

for (const file of readdirSync(RUNS).filter((f) => f.endsWith('.json'))) {
  const run = JSON.parse(readFileSync(join(RUNS, file), 'utf8'));
  if (run.status !== 'passed' && !all) { console.log(`skip  ${run.job} (${run.status}; --all to publish it)`); continue; }

  // This journey's previous clips go first, so a run with fewer people than the
  // last one leaves no stale clip behind.
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`${run.job}-`) && f.endsWith('.mp4')) rmSync(join(OUT, f));
  }
  const videos = [];
  for (const clip of run.videos ?? []) {
    const src = join(RUNS, `${run.job}-${clip.i}.mp4`);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(OUT, `${run.job}-${clip.i}.mp4`));
    videos.push({ i: clip.i, role: clip.role });
  }
  // `output` is the tail of the terminal log — useful locally, noise in public.
  const { output: _drop, ...published } = run;
  writeFileSync(
    join(OUT, `${run.job}.json`),
    `${JSON.stringify({ ...published, videos, hasVideo: videos.length > 0, publishedAt: Date.now() }, null, 2)}\n`,
  );
  console.log(`ok    ${run.job} (${run.status}, ${videos.length} clip${videos.length === 1 ? '' : 's'}${videos.length ? ': ' + videos.map((v) => v.role || '—').join(', ') : ''})`);
}
