// admin.zhiyuantech.ai — static site with one gated folder.
//
// Everything under /nct/downloads/ (the plan bundles) asks for a passphrase over HTTP Basic
// auth; any username works, the password is the DOWNLOADS_PASSPHRASE secret. Every other path
// is served straight from the assets binding, exactly as before.
//
// Fails closed: with no secret set, the bundles are refused rather than served. Set it with
//   cd hosting/site && echo|set /p=<passphrase>| npx wrangler secret put DOWNLOADS_PASSPHRASE
// (or `printf %s '<passphrase>' | npx wrangler secret put DOWNLOADS_PASSPHRASE` in bash).
const GATED = "/nct/downloads/";
const REALM = 'Basic realm="ZYT plan bundles", charset="UTF-8"';

// Constant-time-ish compare so a wrong guess cannot be timed character by character.
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function given(request) {
  const header = request.headers.get("Authorization") || "";
  if (!/^Basic /i.test(header)) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const colon = decoded.indexOf(":");
    return colon === -1 ? "" : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

function ask(message) {
  return new Response(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": REALM,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(GATED)) return env.ASSETS.fetch(request);

    const secret = env.DOWNLOADS_PASSPHRASE;
    if (!secret) {
      return new Response(
        "The plan bundles are not available yet: no passphrase is set on this Worker.\n" +
          "Ask Wilfred to set DOWNLOADS_PASSPHRASE, or get the plans from him directly.\n",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }

    const supplied = given(request);
    if (supplied === null) return ask("This download needs the passphrase Wilfred gave you.\n");
    if (!same(supplied, secret)) return ask("That passphrase is not right.\n");

    // Authorised: serve the file, but never let a cache hold it for the next visitor.
    const response = await env.ASSETS.fetch(request);
    const gated = new Response(response.body, response);
    gated.headers.set("Cache-Control", "no-store");
    return gated;
  },
};
