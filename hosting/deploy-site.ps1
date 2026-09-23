# Builds the ZYT client-projects site and deploys it to Cloudflare Workers.
#
#   /                            dashboard: projects · to-do · task panel   hosting/hub/index.html
#   /nct/customer-intake-sop/    NCT SOP + 32 screenshots (no fix list)     customer-intake-sop/sop.json
#   /jwa/full-chain-sop/         JWA SOP + its screenshots                  JWASystemv2/jwa-sop/sop/jwa-full-chain/sop.json (main)
#   /harper/guest-concierge-sop/ Harper Suite WhatsApp concierge SOP        OpenWA/sop/guest-concierge/sop.json
#
# Live at https://admin.zhiyuantech.ai — Worker "zyt-admin" in Ngchwanlii@zhiyuantech.ai's
# Account (it owns the zhiyuantech.ai zone). PUBLIC: anyone with the link can read it and tick.
# Task content comes from tracker/seed (via hosting/hub/projects.json); tick state lives in
# Convex (hosting/convex-app, prod URL in hosting/convex-app/deployment.json).
# Brand (logo, favicons, palette) comes from zhiyuantech.ai: hosting/hub/brand/BRAND.md.
#
#   powershell -File C:\Project\ZYT-Task\hosting\deploy-site.ps1            build + deploy
#   powershell -File C:\Project\ZYT-Task\hosting\deploy-site.ps1 -DryRun    build only
#   powershell -File C:\Project\ZYT-Task\hosting\deploy-site.ps1 -DryRun -ConvexUrl <url>
#                                                                 build against another deployment
param([switch]$DryRun, [string]$ConvexUrl)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$site = Join-Path $PSScriptRoot 'site'
$public = Join-Path $site 'public'
$pwa = Join-Path $PSScriptRoot 'pwa'
$brand = Join-Path $PSScriptRoot 'hub\brand'
$utf8 = New-Object Text.UTF8Encoding $false

# -- one build/deploy at a time ------------------------------------------------
# Two sessions building at once overwrite each other's public/ folder, and the last deploy wins.
# The lock is created atomically (CreateNew fails if the file exists). A lock whose process has
# gone, or that is older than 45 minutes, is stale and gets replaced. Dry runs take it too,
# because they rewrite public/ as well. The lock lives beside public/, so it is never uploaded.
$lockPath = Join-Path $site '.deploy.lock'
function Enter-DeployLock {
  New-Item -ItemType Directory -Force (Split-Path -Parent $lockPath) | Out-Null
  for ($attempt = 0; $attempt -lt 2; $attempt++) {
    try {
      $fs = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
      $mode = if ($DryRun) { 'dry-run' } else { 'deploy' }
      $info = @{ pid = $PID; host = $env:COMPUTERNAME; user = $env:USERNAME; mode = $mode; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress
      $bytes = [Text.Encoding]::UTF8.GetBytes($info)
      $fs.Write($bytes, 0, $bytes.Length)
      $fs.Close()
      return
    } catch {
      if (-not (Test-Path $lockPath)) { throw }
      $held = $null
      try { $held = Get-Content -Raw $lockPath | ConvertFrom-Json } catch { }
      $alive = $held -and $held.pid -and (Get-Process -Id $held.pid -ErrorAction SilentlyContinue)
      $ageMin = 999
      if ($held -and $held.startedAt) { $ageMin = ((Get-Date) - [datetime]$held.startedAt).TotalMinutes }
      if ($alive -and $ageMin -lt 45) {
        throw "Another build/deploy is running (pid $($held.pid), $($held.mode), started $($held.startedAt)). Wait for it to finish, or delete $lockPath if you are sure it is not running."
      }
      Write-Warning "Replacing a stale deploy lock (pid $($held.pid), started $($held.startedAt))."
      Remove-Item -Force $lockPath -ErrorAction SilentlyContinue
    }
  }
  throw "Could not take the deploy lock at $lockPath."
}
function Exit-DeployLock {
  try {
    $held = Get-Content -Raw $lockPath -ErrorAction Stop | ConvertFrom-Json
    if ($held.pid -eq $PID) { Remove-Item -Force $lockPath -ErrorAction SilentlyContinue }
  } catch { }
}
Enter-DeployLock
try {

function Write-Utf8([string]$path, [string]$text) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $path) | Out-Null
  [IO.File]::WriteAllText($path, $text, $utf8)
}

# ── Convex URL: explicit, else the production deployment ─────────────────────
if (-not $ConvexUrl) {
  $deployment = Join-Path $PSScriptRoot 'convex-app\deployment.json'
  if (Test-Path $deployment) { $ConvexUrl = (Get-Content -Raw $deployment | ConvertFrom-Json).prodUrl }
}
if ($ConvexUrl -notmatch '^https://[a-z0-9-]+\.[a-z0-9.-]*convex\.cloud/?$') {
  throw "No valid Convex URL. Pass -ConvexUrl or write prodUrl to hosting/convex-app/deployment.json (got '$ConvexUrl')."
}

# Empty the folder rather than deleting it: a running `wrangler dev` holds a
# handle on the directory itself.
New-Item -ItemType Directory -Force $public | Out-Null
Get-ChildItem -Force $public | Remove-Item -Recurse -Force

# Web app wiring and brand icons shared by every page: one manifest and one
# service worker at the root, so installing from any page installs the whole site.
$pwaHead = @'
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="ZYT Projects">
'@
$pwaScript = "<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');});}</script>"

# ── NCT: When a Customer Comes In ─────────────────────────────────────────────
# Built from data with the zyt-setup template (roles view) with --no-ledger: NCT's fix list lives in
# the dashboard's Findings (tracker/seed/tasks-nct.json, from the same sop.json). The hand-written
# customer-intake-sop.html is only used if the data file is missing.
$nctData = Join-Path $root 'customer-intake-sop\sop.json'
$sopSrcPath = Join-Path $root 'customer-intake-sop.html'
if (Test-Path $nctData) {
  $sopSrcPath = Join-Path $site 'customer-intake-sop.built.html'
  $eap0 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $nctOut = & node (Join-Path $env:USERPROFILE '.claude\skills\zyt-setup\scripts\build-page.mjs') --data $nctData --out $sopSrcPath --no-ledger 2>&1
  $nctExit = $LASTEXITCODE; $ErrorActionPreference = $eap0
  if ($nctExit -ne 0) { throw "build-page.mjs failed for NCT:`n$($nctOut -join "`n")" }
  $nctOut | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } | ForEach-Object { Write-Output "$_" }
}
$sopSrc = [IO.File]::ReadAllText($sopSrcPath)
$shotsSrc = Join-Path $root 'customer-intake-sop\shots'
$sopDir = Join-Path $public 'nct\customer-intake-sop'

$refs = [regex]::Matches($sopSrc, 'customer-intake-sop/shots/([a-z0-9-]+\.jpg)') |
  ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @($refs | Where-Object { -not (Test-Path (Join-Path $shotsSrc $_)) })
if ($missing.Count) { throw "Missing screenshots: $($missing -join ', ')" }

# The source is written for claude.ai artifacts, which add the document
# skeleton and a small reset, so both are added here. Screenshots sit next to
# the page, so their paths lose the folder prefix. A slim bar leads back to the
# dashboard; it uses the SOP's own colour tokens so it follows the page into dark mode.
$sopBody = $sopSrc.Replace('customer-intake-sop/shots/', 'shots/')
# ZYT top bar, same shape as the dashboard's: logo -> site root, Client projects / NCT, theme button.
# Styled by hub/sop-layout.css, button wired in hub/sop-layout.js. Non-ASCII text is written as
# entities because Windows PowerShell reads this file as ANSI.
$sun  = '<svg class="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
$moon = '<svg class="moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
$logoAlt = 'ZYT &middot; Zhiyuan Technology &middot; &#x81F4;&#x6E90;&#x79D1;&#x6280;'
$backBar = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">' +
           '<header class="zyt-top">' +
           '<a class="zyt-brand" href="/" aria-label="ZYT &#x81F4;&#x6E90;&#x79D1;&#x6280; &mdash; client projects home">' +
           '<img class="zyt-logo-light" src="/brand/logo-light-72.png" alt="' + $logoAlt + '" width="337" height="72">' +
           '<img class="zyt-logo-dark" src="/brand/logo-dark-72.png" alt="' + $logoAlt + '" width="361" height="72"></a>' +
           '<span class="zyt-divider" aria-hidden="true"></span>' +
           '<nav class="zyt-crumbs" aria-label="Breadcrumb"><a href="/?company=__CO_KEY__">Client projects</a><span aria-hidden="true">/</span><span aria-current="page">__CO_LABEL__</span></nav>' +
           '<button type="button" class="zyt-theme" id="zyt-theme" aria-label="Switch to light mode">' + $sun + $moon + '</button>' +
           '</header>'
$reset = "<style>body{margin:0}[hidden]{display:none!important}</style>`n"
# Same theme as the dashboard: dark unless this browser chose light there (zyt.theme).
$themeScript = "<script>(function(){var t='dark';try{t=localStorage.getItem('zyt.theme')||'dark'}catch(e){}" +
               "t=t==='light'?'light':'dark';document.documentElement.setAttribute('data-theme',t);" +
               "var m=document.querySelector('meta[name=`"theme-color`"]');if(m)m.setAttribute('content',t==='dark'?'#04061a':'#ffffff')})();</script>`n"
# Golden path panel (hub/golden-path.js + .css): the runner client shared by the dashboard and
# every SOP page, inlined rather than served as its own URL so nothing has to be added to the
# service worker's PAGES list and no page can be served with a stale copy of the other half.
$goldenCss = "<style>`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\golden-path.css')) + "`n</style>"
$goldenJs  = "<script>`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\golden-path.js')) + "`n</script>"
# ZYT palette + hosted layout CSS, placed right after the page's own <style> so its token blocks
# win. It must come before the page's markup: at the end of the ~370 KB body the browser painted
# the page in its own amber palette with an unstyled top bar first, then flipped to the ZYT one.
$sopCss = $goldenCss + "`n" +
          "<style>`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\sop-theme.css')) + "`n</style>`n" +
          # hosted layout: top bar styles, top block in Step 01's pane, chart guide sheet, window-tall ledger
          "<style>`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\sop-layout.css')) + "`n</style>`n"
$sopJs = $goldenJs + "`n" +
         # scrollbar width for the full-bleed ledger (see sop-theme.css)
         "<script>(function(){function s(){document.documentElement.style.setProperty('--zyt-sbw',Math.max(0,window.innerWidth-document.documentElement.clientWidth)+'px')}" +
         "s();addEventListener('resize',s);addEventListener('load',s)})();</script>`n" +
         "<script>`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\sop-layout.js')) + "`n</script>"
# Wraps an artifact-style SOP body (no html/head/body) in the hosted page; shared by every SOP.
function Get-SopHtml([string]$body, [string]$coKey, [string]$coLabel) {
  $bar = $backBar.Replace('__CO_KEY__', $coKey).Replace('__CO_LABEL__', $coLabel)
  $i = $body.IndexOf('</style>')
  $body = if ($i -ge 0) { $body.Insert($i + 8, "`n" + $sopCss) } else { $sopCss + $body }
  "<!doctype html>`n<html lang=`"en`">`n<head>`n<meta charset=`"utf-8`">`n" +
  "<meta name=`"viewport`" content=`"width=device-width,initial-scale=1`">`n" +
  "<meta name=`"robots`" content=`"noindex,nofollow`">`n" + $pwaHead + $themeScript + $reset +
  "</head>`n<body>`n" + $bar + "`n" + $body + "`n" + $sopJs + "`n" + $pwaScript + "`n</body>`n</html>`n"
}
$sopHtml = Get-SopHtml $sopBody 'nct' 'NCT'
Write-Utf8 (Join-Path $sopDir 'index.html') $sopHtml
New-Item -ItemType Directory -Force (Join-Path $sopDir 'shots') | Out-Null
Copy-Item (Join-Path $shotsSrc '*.jpg') (Join-Path $sopDir 'shots')

# -- NCT: steps 1-3 runbook (same Markdown renderer) -------------------------------------------
$r13Src = Join-Path $root 'steps-1-3-runbook.md'
$r13Body = Join-Path $site 'steps-1-3-runbook.body.html'
node (Join-Path $PSScriptRoot 'hub\build-runbook.mjs') $r13Src $r13Body '--download=/nct/downloads/steps-1-3-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the steps 1-3 runbook (run npm install in hosting/ if marked is missing)' }
Write-Utf8 (Join-Path $public 'nct\steps-1-3-runbook\index.html') (Get-SopHtml ([IO.File]::ReadAllText($r13Body)) 'nct' 'NCT')

# -- NCT: steps 4-10 runbook (Markdown -> page, same wrapper and palette as the SOPs) -----------
# Rendered with `marked` from hosting/node_modules (npm install in hosting/ once).
$rbSrc = Join-Path $root 'steps-4-10-runbook.md'
$rbBody = Join-Path $site 'steps-4-10-runbook.body.html'
node (Join-Path $PSScriptRoot 'hub\build-runbook.mjs') $rbSrc $rbBody '--download=/nct/downloads/steps-4-10-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed (run npm install in hosting/ if marked is missing)' }
Write-Utf8 (Join-Path $public 'nct\steps-4-10-runbook\index.html') (Get-SopHtml ([IO.File]::ReadAllText($rbBody)) 'nct' 'NCT')

# -- NCT: steps 11-15 runbook (same Markdown renderer) ----------------------------------------
$r1115Src = Join-Path $root 'steps-11-15-runbook.md'
$r1115Body = Join-Path $site 'steps-11-15-runbook.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $r1115Src $r1115Body '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the steps 11-15 runbook' }
Write-Utf8 (Join-Path $public 'nct/steps-11-15-runbook/index.html') (Get-SopHtml ([IO.File]::ReadAllText($r1115Body)) 'nct' 'NCT')

# -- NCT: step 11 plan (same Markdown renderer, kicker "Plan") ---------------------------------
$p11Src = Join-Path $root 'plans\step-11-convert-won-quote.md'
$p11Body = Join-Path $site 'step-11-plan.body.html'
node (Join-Path $PSScriptRoot 'hub\build-runbook.mjs') $p11Src $p11Body 'Plan' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the step 11 plan' }
Write-Utf8 (Join-Path $public 'nct\step-11-plan\index.html') (Get-SopHtml ([IO.File]::ReadAllText($p11Body)) 'nct' 'NCT')

# -- NCT: steps 12-15 plans and their crosscheck (same Markdown renderer, kicker "Plan") ------
$p12Src = Join-Path $root 'plans/step-12-job-number.md'
$p12Body = Join-Path $site 'step-12-plan.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $p12Src $p12Body 'Plan' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the step 12 plan' }
Write-Utf8 (Join-Path $public 'nct/step-12-plan/index.html') (Get-SopHtml ([IO.File]::ReadAllText($p12Body)) 'nct' 'NCT')

$p13Src = Join-Path $root 'plans/step-13-intake-decisions.md'
$p13Body = Join-Path $site 'step-13-plan.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $p13Src $p13Body 'Plan' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the step 13 plan' }
Write-Utf8 (Join-Path $public 'nct/step-13-plan/index.html') (Get-SopHtml ([IO.File]::ReadAllText($p13Body)) 'nct' 'NCT')

$p14Src = Join-Path $root 'plans/step-14-job-shape.md'
$p14Body = Join-Path $site 'step-14-plan.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $p14Src $p14Body 'Plan' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the step 14 plan' }
Write-Utf8 (Join-Path $public 'nct/step-14-plan/index.html') (Get-SopHtml ([IO.File]::ReadAllText($p14Body)) 'nct' 'NCT')

$p15Src = Join-Path $root 'plans/step-15-order-approval-integrity.md'
$p15Body = Join-Path $site 'step-15-plan.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $p15Src $p15Body 'Plan' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the step 15 plan' }
Write-Utf8 (Join-Path $public 'nct/step-15-plan/index.html') (Get-SopHtml ([IO.File]::ReadAllText($p15Body)) 'nct' 'NCT')

$xcSrc = Join-Path $root 'plans/steps-12-15-crosscheck.md'
$xcBody = Join-Path $site 'steps-12-15-crosscheck.body.html'
node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $xcSrc $xcBody 'Crosscheck' 'NCT Freight Forwarding' 'NCT' '--download=/nct/downloads/steps-11-15-plans.zip'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the steps 12-15 crosscheck' }
Write-Utf8 (Join-Path $public 'nct/steps-12-15-crosscheck/index.html') (Get-SopHtml ([IO.File]::ReadAllText($xcBody)) 'nct' 'NCT')

# -- NCT: plans 01-10 and the steps 4-10 crosscheck (published, unlisted; plan 09-23 Phase 2) ---
# Same row shape as $nctPages1627 below. The plan pages are in projects.json `unlisted`; the
# crosscheck is a `pages` entry with nav "hidden", so neither shows in the sidebar.
$nctPages0110 = @(
  @{ src = 'plans/step-01-enquiry-channel.md';                page = 'step-01-plan';            kind = 'Plan';       zip = 'steps-1-3-plans.zip' },
  @{ src = 'plans/step-02-credit-and-duplicates.md';          page = 'step-02-plan';            kind = 'Plan';       zip = 'steps-1-3-plans.zip' },
  @{ src = 'plans/step-03-contact-nomination.md';             page = 'step-03-plan';            kind = 'Plan';       zip = 'steps-1-3-plans.zip' },
  @{ src = 'plans/step-04-rate-card-gate.md';                 page = 'step-04-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-05-quotation-date-and-staff.md';       page = 'step-05-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-06-tariff-quantity-from-containers.md'; page = 'step-06-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-07-ambiguous-tariff-floor.md';         page = 'step-07-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-08-quotation-approval-integrity.md';   page = 'step-08-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-09-send-outbox.md';                    page = 'step-09-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/step-10-decision-correction.md';            page = 'step-10-plan';            kind = 'Plan';       zip = 'steps-4-10-plans.zip' },
  @{ src = 'plans/steps-4-10-crosscheck.md';                  page = 'steps-4-10-crosscheck';   kind = 'Crosscheck'; zip = 'steps-4-10-plans.zip' }
)

# -- NCT: steps 16-19, 20-26 and 27 — runbooks, plans and crosschecks (same Markdown renderer) ---
# Each row: source (repo-relative), output page folder under nct/, kicker, download bundle.
$nctPages1627 = @(
  @{ src = 'steps-16-19-runbook.md';                     page = 'steps-16-19-runbook';     kind = 'Runbook';    zip = 'steps-16-19-plans.zip' },
  @{ src = 'plans/step-16-lading-create.md';             page = 'step-16-plan';            kind = 'Plan';       zip = 'steps-16-19-plans.zip' },
  @{ src = 'plans/step-17-lading-states-and-review.md';  page = 'step-17-plan';            kind = 'Plan';       zip = 'steps-16-19-plans.zip' },
  @{ src = 'plans/step-18-bl-document-approval.md';      page = 'step-18-plan';            kind = 'Plan';       zip = 'steps-16-19-plans.zip' },
  @{ src = 'plans/step-19-demurrage-clock-reach.md';     page = 'step-19-plan';            kind = 'Plan';       zip = 'steps-16-19-plans.zip' },
  @{ src = 'plans/steps-16-19-crosscheck.md';            page = 'steps-16-19-crosscheck';  kind = 'Crosscheck'; zip = 'steps-16-19-plans.zip' },
  @{ src = 'steps-20-26-runbook.md';                     page = 'steps-20-26-runbook';     kind = 'Runbook';    zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-20-fee-entry-integrity.md';       page = 'step-20-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-21-fee-review-integrity.md';      page = 'step-21-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-22-bill-grouping-integrity.md';   page = 'step-22-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-23-bill-approval-integrity.md';   page = 'step-23-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-24-invoice-issue-integrity.md';   page = 'step-24-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-25-invoice-document-truth.md';    page = 'step-25-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/step-26-settlement-integrity.md';      page = 'step-26-plan';            kind = 'Plan';       zip = 'steps-20-26-plans.zip' },
  @{ src = 'plans/steps-20-26-crosscheck.md';            page = 'steps-20-26-crosscheck';  kind = 'Crosscheck'; zip = 'steps-20-26-plans.zip' },
  @{ src = 'step-27-runbook.md';                         page = 'step-27-runbook';         kind = 'Runbook';    zip = 'step-27-plans.zip' },
  @{ src = 'plans/step-27-month-close-truth.md';         page = 'step-27-plan';            kind = 'Plan';       zip = 'step-27-plans.zip' }
)
foreach ($p in $nctPages0110 + $nctPages1627) {
  $pSrc = Join-Path $root $p.src
  $pBody = Join-Path $site "$($p.page).body.html"
  node (Join-Path $PSScriptRoot 'hub/build-runbook.mjs') $pSrc $pBody $p.kind 'NCT Freight Forwarding' 'NCT' "--download=/nct/downloads/$($p.zip)"
  if ($LASTEXITCODE -ne 0) { throw "build-runbook.mjs failed for $($p.src)" }
  Write-Utf8 (Join-Path $public "nct/$($p.page)/index.html") (Get-SopHtml ([IO.File]::ReadAllText($pBody)) 'nct' 'NCT')
}

# -- ZYT: commands reference for the zyt skills and this site (same Markdown renderer) -----------
$zcSrc = Join-Path $root 'docs\zyt-commands.md'
$zcBody = Join-Path $site 'zyt-commands.body.html'
node (Join-Path $PSScriptRoot 'hub\build-runbook.mjs') $zcSrc $zcBody 'Commands' 'Zhiyuan Technology' 'ZYT'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the ZYT commands page' }
Write-Utf8 (Join-Path $public 'zyt\commands\index.html') (Get-SopHtml ([IO.File]::ReadAllText($zcBody)) 'zyt' 'ZYT')

# ── JWA: SRF full chain (built from sop.json, public build: no fix list) ──────
# Source is JWASystemv2\jwa-sop: a worktree of jwa-system on MAIN, used only for this.
# Until 2026-09-23 it was the jwa-system dev checkout, whose branch trailed main, so
# main's copy of the ledger kept falling behind the published page. Ledger changes now
# land on main through PRs, and this fast-forwards the worktree before every build so
# the page is always built from what main says. A worktree that cannot fast-forward
# (local commits, a branch switch, conflicts) stops the build instead of publishing it.
$jwaRepo = Join-Path $root '..\JWASystemv2\jwa-sop'
$jwaBranch = (git -C $jwaRepo rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $jwaBranch -ne 'main') {
  throw "JWA SOP source $jwaRepo must be a worktree on 'main' (found '$jwaBranch')."
}
git -C $jwaRepo fetch --quiet origin main
if ($LASTEXITCODE -ne 0) { throw "git fetch failed in $jwaRepo" }
git -C $jwaRepo merge --quiet --ff-only origin/main
if ($LASTEXITCODE -ne 0) { throw "JWA SOP source $jwaRepo cannot fast-forward to origin/main; fix it by hand." }
Write-Host ("JWA SOP source: main @ " + (git -C $jwaRepo rev-parse --short HEAD).Trim())
$jwaSopRoot = Join-Path $jwaRepo 'sop'
$jwaData = Join-Path $jwaSopRoot 'jwa-full-chain\sop.json'
$jwaShotsSrc = Join-Path $jwaSopRoot 'jwa-full-chain\shots'
$jwaDir = Join-Path $public 'jwa\full-chain-sop'
$jwaBuilt = Join-Path $site 'jwa-full-chain-sop.html'
# build-page.mjs warns on stderr that shots are missing next to --out; that check is done below instead.
$eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
# Trust line: only when a full audit recorded verifiedAt for the page in the zyt registry.
# Fix list public on JWA too (user decision 2026-09-16), same as NCT.
$buildArgs = @('--data', $jwaData, '--out', $jwaBuilt)
$regFile = Join-Path $env:USERPROFILE '.claude\zyt\pages.json'
if (Test-Path $regFile) {
  $jwaReg = (Get-Content $regFile -Raw | ConvertFrom-Json).pages | Where-Object { $_.id -eq 'jwa-system/jwa-full-chain' } | Select-Object -First 1
  if ($jwaReg -and $jwaReg.verifiedAt) {
    $buildArgs += @('--verified-at', [string]$jwaReg.verifiedAt)
    if ($jwaReg.verifiedCommit) { $buildArgs += @('--verified-commit', [string]$jwaReg.verifiedCommit) }
  }
}
$buildOut = & node (Join-Path $env:USERPROFILE '.claude\skills\zyt-setup\scripts\build-page.mjs') @buildArgs 2>&1
$buildExit = $LASTEXITCODE; $ErrorActionPreference = $eap
if ($buildExit -ne 0) { throw "build-page.mjs failed for JWA:`n$($buildOut -join "`n")" }
$buildOut | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } | ForEach-Object { Write-Output "$_" }
$jwaSrc = [IO.File]::ReadAllText($jwaBuilt)
$jwaRefs = [regex]::Matches($jwaSrc, 'jwa-full-chain/shots/([a-z0-9-]+\.png)') |
  ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
if (-not $jwaRefs) { throw "JWA SOP references no screenshots - check $jwaData" }
$missing = @($jwaRefs | Where-Object { -not (Test-Path (Join-Path $jwaShotsSrc $_)) })
if ($missing.Count) { throw "Missing JWA screenshots: $($missing -join ', ')" }
Write-Utf8 (Join-Path $jwaDir 'index.html') (Get-SopHtml $jwaSrc.Replace('jwa-full-chain/shots/', 'shots/') 'jwa' 'JWA')
New-Item -ItemType Directory -Force (Join-Path $jwaDir 'shots') | Out-Null
$jwaRefs | ForEach-Object { Copy-Item (Join-Path $jwaShotsSrc $_) (Join-Path $jwaDir 'shots') }

# -- Harper Suite: WhatsApp guest concierge (Kapso repo, built from sop.json, fix list public) --
# No screenshots: the guest steps happen in WhatsApp and the staff steps in the Kapso dashboard.
$hsData = Join-Path $root '..\OpenWA\sop\guest-concierge\sop.json'
$hsBuilt = Join-Path $site 'harper-guest-concierge-sop.html'
$eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$hsOut = & node (Join-Path $env:USERPROFILE '.claude\skills\zyt-setup\scripts\build-page.mjs') --data $hsData --out $hsBuilt 2>&1
$hsExit = $LASTEXITCODE; $ErrorActionPreference = $eap
if ($hsExit -ne 0) { throw "build-page.mjs failed for Harper Suite:`n$($hsOut -join "`n")" }
$hsOut | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } | ForEach-Object { Write-Output "$_" }
Write-Utf8 (Join-Path $public 'harper\guest-concierge-sop\index.html') (Get-SopHtml ([IO.File]::ReadAllText($hsBuilt)) 'harper' 'Harper Suite')

# -- Harper Suite: every question the bot answers, generated from the bot's own knowledge base --
$baMd = Join-Path $site 'harper-bot-answers.md'
$baBody = Join-Path $site 'harper-bot-answers.body.html'
# OpenWA f1578a5 moved kb.md, unchanged, to prompt/legacy/ when ready-made replies (presets.json) took
# over from KB paraphrasing; this page is still built from that knowledge base
$baKb = Join-Path $root '..\OpenWA\kapso\prompt\legacy\kb.md'
node (Join-Path $PSScriptRoot 'hub\build-bot-answers.mjs') $baKb (Join-Path $root '..\OpenWA\sop\guest-concierge\other-flows.md') $baMd
if ($LASTEXITCODE -ne 0) { throw 'build-bot-answers.mjs failed for Harper Suite' }
node (Join-Path $PSScriptRoot 'hub\build-runbook.mjs') $baMd $baBody 'Reference' 'Harper Suite' 'Harper'
if ($LASTEXITCODE -ne 0) { throw 'build-runbook.mjs failed for the Harper bot answers page' }
Write-Utf8 (Join-Path $public 'harper\bot-answers\index.html') (Get-SopHtml ([IO.File]::ReadAllText($baBody)) 'harper' 'Harper Suite')

# ── downloadable plan bundles ────────────────────────────────────────────────
# One zip per runbook: the runbook's own markdown plus the plans its prompts name, so a
# colleague can unzip to C:/nct-plans/ and follow it. The plans are also in git (plans/), and
# every file here is readable as a page on this public site; the zip is the one-click copy.
$downloads = Join-Path $public 'nct\downloads'
New-Item -ItemType Directory -Force $downloads | Out-Null
$bundles = @(
  @{ zip = 'steps-1-3-plans.zip';   files = @('steps-1-3-runbook.md', 'plans\step-01-enquiry-channel.md', 'plans\step-02-credit-and-duplicates.md', 'plans\step-03-contact-nomination.md') },
  @{ zip = 'steps-4-10-plans.zip';  files = @('steps-4-10-runbook.md', 'plans\step-04-rate-card-gate.md', 'plans\step-05-quotation-date-and-staff.md', 'plans\step-06-tariff-quantity-from-containers.md', 'plans\step-07-ambiguous-tariff-floor.md', 'plans\step-08-quotation-approval-integrity.md', 'plans\step-09-send-outbox.md', 'plans\step-10-decision-correction.md', 'plans\steps-4-10-crosscheck.md') },
  @{ zip = 'steps-11-15-plans.zip'; files = @('steps-11-15-runbook.md', 'plans\step-11-convert-won-quote.md', 'plans\step-12-job-number.md', 'plans\step-13-intake-decisions.md', 'plans\step-14-job-shape.md', 'plans\step-15-order-approval-integrity.md', 'plans\steps-12-15-crosscheck.md') },
  @{ zip = 'steps-16-19-plans.zip'; files = @('steps-16-19-runbook.md', 'plans\step-16-lading-create.md', 'plans\step-17-lading-states-and-review.md', 'plans\step-18-bl-document-approval.md', 'plans\step-19-demurrage-clock-reach.md', 'plans\steps-16-19-crosscheck.md') },
  @{ zip = 'steps-20-26-plans.zip'; files = @('steps-20-26-runbook.md', 'plans\step-20-fee-entry-integrity.md', 'plans\step-21-fee-review-integrity.md', 'plans\step-22-bill-grouping-integrity.md', 'plans\step-23-bill-approval-integrity.md', 'plans\step-24-invoice-issue-integrity.md', 'plans\step-25-invoice-document-truth.md', 'plans\step-26-settlement-integrity.md', 'plans\steps-20-26-crosscheck.md') },
  @{ zip = 'step-27-plans.zip';     files = @('step-27-runbook.md', 'plans\step-27-month-close-truth.md') }
)
# The everything bundle: every plan and crosscheck in plans/, plus every runbook.
$allPlans = @(Get-ChildItem (Join-Path $root 'plans') -Filter *.md | ForEach-Object { "plans\$($_.Name)" })
if ($allPlans.Count -lt 5) { throw "all-plans.zip: only $($allPlans.Count) files found in plans/" }
$bundles += @{ zip = 'all-plans.zip'; files = @('steps-1-3-runbook.md', 'steps-4-10-runbook.md', 'steps-11-15-runbook.md', 'steps-16-19-runbook.md', 'steps-20-26-runbook.md', 'step-27-runbook.md') + $allPlans }

foreach ($b in $bundles) {
  $paths = @()
  foreach ($f in $b.files) {
    $full = Join-Path $root $f
    if (-not (Test-Path $full)) { throw "Bundle $($b.zip) names a missing file: $f" }
    $paths += $full
  }
  $target = Join-Path $downloads $b.zip
  Compress-Archive -Path $paths -DestinationPath $target -Force
  $kb = [math]::Round((Get-Item $target).Length / 1KB)
  Write-Output "bundle: $($b.zip) - $($paths.Count) files, $kb KB"
}

# ── dashboard ─────────────────────────────────────────────────────────────────
$seedFile = Join-Path $site 'seed.json'
# --public: every task's download zip must be among the bundles built above
node (Join-Path $PSScriptRoot 'hub\build-seed.mjs') $seedFile --public $public
if ($LASTEXITCODE -ne 0) { throw 'build-seed.mjs failed' }
$seedJson = [IO.File]::ReadAllText($seedFile)

# -- seed-row preflight: every tickable key must already have a Convex row -----------------
# A finding or runbook step without a row cannot be ticked ("That task does not exist."), so a real
# deploy refuses to ship one; seed:<project> must run on that deployment first (prod: Wilfred).
# A DryRun only warns. Plain ASCII here: Windows PowerShell reads this file as ANSI.
$seedData = $seedJson | ConvertFrom-Json
foreach ($proj in $seedData.projects) {
  $keys = @($proj.tasks | ForEach-Object { $_.id })
  if ($proj.runbook) { $keys += @($proj.runbook.stages | ForEach-Object { $_.steps } | ForEach-Object { $_.id }) }
  if (-not $keys.Count) { continue }
  $base = $ConvexUrl.TrimEnd('/')
  $body = @{ path = 'findings:board'; args = @{ projectKey = $proj.key }; format = 'json' } | ConvertTo-Json -Compress
  try {
    $res = Invoke-RestMethod -Method Post -Uri "$base/api/query" -ContentType 'application/json' -Body $body -TimeoutSec 30
  } catch {
    $msg = "Could not ask Convex $base for $($proj.key)'s rows: $($_.Exception.Message)"
    if ($DryRun) { Write-Warning $msg; continue } else { throw $msg }
  }
  if ($res.status -ne 'success') {
    $msg = "Convex $base answered '$($res.status)' for $($proj.key): $($res.errorMessage)"
    if ($DryRun) { Write-Warning $msg; continue } else { throw $msg }
  }
  $have = @{}
  foreach ($f in $res.value.findings) { $have[$f.key] = $true }
  $missing = @($keys | Where-Object { -not $have.ContainsKey($_) })
  if ($missing.Count) {
    $shown = ($missing | Select-Object -First 20) -join ', '
    if ($missing.Count -gt 20) { $shown += ", ... ($($missing.Count) in all)" }
    $msg = "Convex $base has no row for [$shown]. Run seed:$($proj.key) on that deployment first (prod: Wilfred)."
    if ($DryRun) { Write-Warning $msg } else { throw $msg }
  } else {
    Write-Output "seed rows: $($proj.key) all $($keys.Count) keys present on $base"
  }
}

$hub = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\index.html'))
$hub = $hub.Replace('<!--PWA_HEAD-->', $pwaHead).Replace('<!--PWA_SCRIPT-->', $pwaScript).
            Replace('{{CONVEX_URL}}', $ConvexUrl.TrimEnd('/')).Replace('/*SEED_JSON*/', $seedJson)
$hub = $hub.Replace('<!--GOLDEN_PATH_JS-->', $goldenJs).Replace('/*GOLDEN_PATH_CSS*/', [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\golden-path.css')))
# the runbook article's rules, shared with build-runbook.mjs (task view body; the sheet copies them)
$hub = $hub.Replace('/*RUNBOOK_CSS*/', [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'hub\runbook-body.css')))
Write-Utf8 (Join-Path $public 'index.html') $hub
Copy-Item (Join-Path $PSScriptRoot 'hub\404.html') $public

# ── golden-path recordings ───────────────────────────────────────────────────
# Each journey's last PUBLISHED recording (video + verdict + step list), served at
# /golden-paths/<job>.json + <job>-<n>.mp4 (one clip per person on screen) so a panel
# can show it with no runner running.
# hosting/recordings/ is TRACKED on purpose: a deploy publishes what is on disk,
# and a deploy from another worktree must not wipe the videos. It is filled by
# `node hosting/runner/publish-recordings.mjs` from the runner's local saves.
$recordings = Join-Path $PSScriptRoot 'recordings'
if (Test-Path $recordings) {
  $gpOut = Join-Path $public 'golden-paths'
  New-Item -ItemType Directory -Force $gpOut | Out-Null
  Copy-Item (Join-Path $recordings '*.mp4'), (Join-Path $recordings '*.json') $gpOut -ErrorAction SilentlyContinue
  Write-Host "golden paths: $(@(Get-ChildItem $gpOut -Filter *.json).Count) journeys, $(@(Get-ChildItem $gpOut -Filter *.mp4).Count) clips published"
}

# ── brand ─────────────────────────────────────────────────────────────────────
$logo = Join-Path $brand 'logo-light-72.png'
if (-not (Test-Path $logo)) { throw "Missing $logo - run hosting/pwa/make-icons.ps1 first" }
New-Item -ItemType Directory -Force (Join-Path $public 'brand') | Out-Null
Copy-Item $logo, (Join-Path $brand 'logo-dark-72.png') (Join-Path $public 'brand')
Copy-Item (Join-Path $brand 'favicon.ico'), (Join-Path $brand 'favicon.svg') $public

# ── web app ───────────────────────────────────────────────────────────────────
Copy-Item (Join-Path $pwa 'manifest.webmanifest') $public
New-Item -ItemType Directory -Force (Join-Path $public 'icons') | Out-Null
Copy-Item (Join-Path $pwa 'icons\*.png') (Join-Path $public 'icons')
# A new cache name per build retires old copies; every screenshot is precached
# so pages work offline from the first visit.
$build = Get-Date -Format 'yyyyMMddHHmmss'
$shotList = (Get-ChildItem (Join-Path $sopDir 'shots') -Filter *.jpg |
  ForEach-Object { "'/nct/customer-intake-sop/shots/$($_.Name)'" }) -join ', '
$shotList += ', ' + (($jwaRefs | ForEach-Object { "'/jwa/full-chain-sop/shots/$_'" }) -join ', ')
$sw = [IO.File]::ReadAllText((Join-Path $pwa 'sw.js')).Replace('__BUILD__', $build).Replace('/*__SHOTS__*/', $shotList)
Write-Utf8 (Join-Path $public 'sw.js') $sw
# Every PAGES path must have been built: one missing page fails the worker's addAll, and the
# install then fails silently, leaving visitors on the old cache.
$pagesLine = [regex]::Match($sw, "const PAGES = \[([^\]]*)\]").Groups[1].Value
foreach ($m in [regex]::Matches($pagesLine, "'([^']+)'")) {
  $pth = $m.Groups[1].Value
  $built = if ($pth -eq '/') { Join-Path $public 'index.html' } else { Join-Path $public (($pth.Trim('/') -replace '/', '\') + '\index.html') }
  if (-not (Test-Path $built)) { throw "sw.js PAGES lists $pth, which was not built" }
}

$files = (Get-ChildItem -Recurse -File $public).Count
Write-Output "Built $public ($files files; Convex $ConvexUrl; NCT SOP references $($refs.Count) screenshots, JWA SOP $($jwaRefs.Count), all present)"
if ($DryRun) { return }

$env:CLOUDFLARE_ACCOUNT_ID = 'a9c786e2839df3157985b75b9195a5dd'
Push-Location $site
try { npx --yes wrangler@4.131.2 deploy } finally { Pop-Location }

} finally {
  Exit-DeployLock
}
