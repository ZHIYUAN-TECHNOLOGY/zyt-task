// Makes Cloudflare Access for admin.zhiyuantech.ai match hosting/hub/projects.json.
//
//   node hosting/access/sync-access.mjs --dry-run    print what would be created or changed
//   node hosting/access/sync-access.mjs              apply it
//
// Who may sign in comes from each company's "access" list (emails, or "@domain" for a whole
// domain): the "zyt" company's list is ZYT staff, who get every page; each client company's
// list gets the whole site's shell plus its own /<key> pages and /golden-paths/<key>-* recordings.
// The dashboard reads the same lists to show a client only their own company.
//
// Everything this script owns is named "zyt-admin · …" and is found again by that name, so a
// re-run updates in place instead of adding duplicates. Anything else in the account is left alone.
//
// Needs CLOUDFLARE_API_TOKEN, from the environment or hosting/access/.env (git-ignored), with the
// Account permission "Access: Apps and Policies: Edit" on the account below, plus identity-provider
// edit only if the account has no one-time PIN login yet. Staff emails go into every policy
// directly (no Access group), so no group or organization permission is needed.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACCOUNT = 'a9c786e2839df3157985b75b9195a5dd';   // owns the zhiyuantech.ai zone (hosting/site/wrangler.jsonc)
const HOST = 'admin.zhiyuantech.ai';
const HOME = 'zyt';
const PREFIX = 'zyt-admin · ';
const SESSION = '168h';                               // sign in again once a week
// Fetched by the browser without cookies (the web-app manifest and its icons), so they must not
// sit behind a sign-in. They hold nothing but branding.
const PUBLIC_PATHS = ['manifest.webmanifest', 'icons/*', 'favicon.ico', 'favicon.svg'];

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dryRun = process.argv.includes('--dry-run');

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim();
  const file = join(here, '.env');
  if (existsSync(file)) {
    const m = readFileSync(file, 'utf8').match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*"?([^"\r\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  return null;
}

// ── what Access should look like ──
function desired() {
  const projects = JSON.parse(readFileSync(join(root, 'hosting', 'hub', 'projects.json'), 'utf8'));
  const clean = (list, key) => (list || []).map((a) => {
    const v = String(a).trim().toLowerCase();
    if (!/^([^@\s]+)?@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) throw new Error(`${key}: "${a}" in "access" is not an email or @domain`);
    return v;
  });
  const home = projects.find((p) => p.key === HOME);
  const staff = clean(home && home.access, HOME);
  if (!staff.length) throw new Error(`projects.json: company "${HOME}" needs an "access" list of staff emails`);
  const clients = projects.filter((p) => p.key !== HOME).map((p) => ({ key: p.key, name: p.name, emails: clean(p.access, p.key) }));

  const rule = (v) => (v.startsWith('@') ? { email_domain: { domain: v.slice(1) } } : { email: { email: v } });
  const everyone = [...new Set(clients.flatMap((c) => c.emails))];

  const apps = [
    { name: PREFIX + 'site', paths: [HOST], allow: everyone },
    { name: PREFIX + 'public assets', paths: PUBLIC_PATHS.map((p) => `${HOST}/${p}`), bypass: true },
    ...clients.map((c) => ({ name: PREFIX + c.key, paths: [`${HOST}/${c.key}`, `${HOST}/golden-paths/${c.key}-*`], allow: c.emails })),
    { name: PREFIX + HOME, paths: [`${HOST}/${HOME}`], allow: [] },
  ];
  return { staff, apps, rule };
}

// ── Cloudflare API ──
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/access`;
let TOKEN = null;
async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const why = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    throw new Error(`${method} /access${path} → ${res.status} ${why}`);
  }
  return json.result;
}
async function list(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}${path}?per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const why = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
      throw new Error(`GET /access${path} → ${res.status} ${why}`);
    }
    out.push(...(json.result || []));
    const info = json.result_info;
    if (!info || !info.total_pages || page >= info.total_pages) return out;
  }
}

// Create when missing, update when different; in a dry run only say which.
async function upsert(kind, path, existing, body, same) {
  if (!existing) {
    console.log(`  create ${kind} "${body.name}"`);
    return dryRun ? { id: `<new ${kind}>` } : cf('POST', path, body);
  }
  if (same(existing)) { console.log(`  keep   ${kind} "${body.name}"`); return existing; }
  console.log(`  update ${kind} "${body.name}"`);
  return dryRun ? existing : cf('PUT', `${path}/${existing.id}`, body);
}
const sortJSON = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const sameRules = (a, b) => sortJSON((a || []).map(sortJSON).sort()) === sortJSON((b || []).map(sortJSON).sort());

async function main() {
  const want = desired();
  console.log(`Access for ${HOST}${dryRun ? ' (dry run: nothing is changed)' : ''}`);
  console.log(`  staff: ${want.staff.join(', ')}`);
  want.apps.forEach((a) => console.log(`  ${a.name}: ${a.paths.join(', ')} → ${a.bypass ? 'anyone (no sign-in)' : 'staff' + (a.allow.length ? ' + ' + a.allow.join(', ') : ' only')}`));

  TOKEN = token();
  if (!TOKEN) {
    console.log('\nNo CLOUDFLARE_API_TOKEN (environment or hosting/access/.env), so this is the plan only.');
    process.exit(dryRun ? 0 : 1);
  }

  console.log('\nChanges:');
  // one-time PIN: reuse any that exists (an account may hold only one)
  const idps = await list('/identity_providers');
  let pin = idps.find((i) => i.type === 'onetimepin');
  if (pin) console.log(`  keep   login method "${pin.name}" (one-time PIN)`);
  else {
    console.log('  create login method "One-time PIN"');
    pin = dryRun ? { id: '<new one-time PIN>' } : await cf('POST', '/identity_providers', { name: 'One-time PIN', type: 'onetimepin', config: {} });
  }

  const policies = await list('/policies');
  const apps = await list('/apps');
  for (const a of want.apps) {
    const include = a.bypass ? [{ everyone: {} }] : [...new Set([...want.staff, ...a.allow])].map(want.rule);
    const pBody = { name: a.name, decision: a.bypass ? 'bypass' : 'allow', include, exclude: [], require: [], session_duration: SESSION };
    const policy = await upsert('policy', '/policies', policies.find((p) => p.name === a.name), pBody,
      (p) => p.decision === pBody.decision && sameRules(p.include, include) && !(p.exclude || []).length && !(p.require || []).length);

    const aBody = {
      name: a.name,
      type: 'self_hosted',
      domain: a.paths[0],
      destinations: a.paths.map((uri) => ({ type: 'public', uri })),
      policies: [{ id: policy.id, precedence: 1 }],
      allowed_idps: [pin.id],
      auto_redirect_to_identity: true,
      session_duration: SESSION,
      app_launcher_visible: false,
    };
    const found = apps.find((x) => x.name === a.name);
    await upsert('app', '/apps', found, aBody, (x) =>
      sortJSON((x.destinations || []).map((d) => d.uri).sort()) === sortJSON([...a.paths].sort())
      && (x.policies || []).length === 1 && x.policies[0].id === policy.id
      && sortJSON(x.allowed_idps || []) === sortJSON([pin.id]) && x.session_duration === SESSION && x.auto_redirect_to_identity === true);
  }

  // anything of ours that projects.json no longer asks for (a company removed)
  const wanted = new Set(want.apps.map((a) => a.name));
  apps.filter((x) => x.name.startsWith(PREFIX) && !wanted.has(x.name))
    .forEach((x) => console.log(`  stale  app "${x.name}" (${(x.destinations || []).map((d) => d.uri).join(', ')}): not deleted; remove it in the dashboard if the company is gone`));

  console.log(dryRun ? '\nDry run done. Re-run without --dry-run to apply.' : '\nDone.');
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1); });
