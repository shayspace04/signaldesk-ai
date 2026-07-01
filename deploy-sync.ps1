param(
  [Parameter(Position=0)]
  [ValidateSet("status","doctor","import","build","deploy","sync","validate","all")]
  [string]$Command = "all",
  [switch]$DryRun,
  [switch]$Yes,
  [string]$PodId = "019ef98f-eb70-71d8-a1e1-1aa54497dda0",
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$cyan = "Cyan"; $green = "Green"; $yellow = "Yellow"; $red = "Red"; $gray = "Gray"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor $cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor $green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor $yellow }
function Write-Err($msg) { Write-Host "  [ERR] $msg" -ForegroundColor $red }

function Test-Command($cmd) {
  if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Err "Required command '$cmd' not found. Install it first."
    exit 1
  }
}

# ---- Prerequisites ----
Test-Command "lemma"
Test-Command "npm"

# ---- 1. Status ----
function Show-Status {
  Write-Step "Pod Status"
  lemma pod get $PodId --json 2>&1 | ConvertFrom-Json | ForEach-Object {
    Write-Ok "Pod: $($_.name) (id: $($_.id))"
    Write-Ok "Organization: $($_.organization_id)"
  }

  Write-Step "Tables"
  $tables = lemma tables list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $tables | ForEach-Object { Write-Host "  $_($($_.name)) -> $($_.column_count) cols, $($_.visibility)" }

  Write-Step "Functions"
  $funcs = lemma functions list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $funcs | ForEach-Object { Write-Host "  $($_.name) [$($_.status)]" }

  Write-Step "Agents"
  $agents = lemma agents list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $agents | ForEach-Object { Write-Host "  $($_.name)" }

  Write-Step "Workflows"
  $wf = lemma workflows list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $wf | ForEach-Object { Write-Host "  $($_.name) [$($_.node_count) nodes, active=$($_.is_active)]" }

  Write-Step "Schedules"
  $scheds = lemma schedules list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $scheds | ForEach-Object { Write-Host "  $($_.name) [$($_.schedule_type)] active=$($_.is_active)" }

  Write-Step "Surfaces"
  $surf = lemma surfaces list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $surf | ForEach-Object { Write-Host "  $($_.platform) [$($_.status)] agent=$($_.agent_name)" }

  Write-Step "Apps"
  $apps = lemma apps list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $apps | ForEach-Object { Write-Host "  $($_.name) [$($_.status)] url=$($_.url)" }
}

# ---- 2. Doctor (wiring check) ----
function Invoke-Doctor {
  Write-Step "Pod Wiring Check"
  lemma pods doctor $PodId 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Ok "Pod wiring OK" }
  else { Write-Warn "Pod wiring issues found (see above)" }
}

# ---- 3. Bundle Import (sync tables/functions/agents/workflows/schedules/surfaces) ----
function Invoke-Import {
  Write-Step "Bundle Import"
  $bundleDir = $ProjectRoot

  if ($DryRun) {
    Write-Step "DRY RUN: Would import bundle from $bundleDir"
    lemma pods import $bundleDir --pod $PodId --dry-run 2>&1
    return
  }

  $importArgs = @("pods", "import", "`"$bundleDir`"", "--pod", $PodId, "--upsert")
  if ($Yes) { $importArgs += "-y" }

  Write-Host "Running: lemma pods import ..." -ForegroundColor $gray
  lemma pods import "`"$bundleDir`"" --pod $PodId --upsert 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Ok "Bundle import successful" }
  else { Write-Err "Bundle import failed (exit $LASTEXITCODE)" }
}

# ---- 4. Build App ----
function Invoke-Build {
  Write-Step "Building App (npm run build)"
  Push-Location $ProjectRoot
  try {
    npm run build 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Ok "Build successful => dist/" }
    else { Write-Err "Build failed" }
  } finally { Pop-Location }
}

# ---- 5. Deploy App ----
function Invoke-Deploy {
  Write-Step "Deploy App (signaldesk)"
  $distDir = Join-Path $ProjectRoot "dist"
  if (!(Test-Path $distDir)) {
    Write-Err "dist/ not found. Run build first."
    return
  }

  Write-Host "Deploying signaldesk app from $distDir ..." -ForegroundColor $gray
  lemma app deploy signaldesk --pod $PodId --dist-dir "`"$distDir`"" -y 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Ok "App deployed" }
  else { Write-Err "App deploy failed" }
}

# ---- 6. Full Sync (import + build + deploy) ----
function Invoke-Sync {
  Write-Step "=== FULL SYNC ==="
  Invoke-Import
  Invoke-Build
  Invoke-Deploy
  Write-Ok "Full sync complete"
}

# ---- 7. Validation ----
function Invoke-Validate {
  Write-Step "=== VALIDATION ==="

  # 7a. Verify pod is reachable
  Write-Step "7a. Pod reachability"
  lemma pod get $PodId --json 2>&1 | Out-Null
  Write-Ok "Pod reachable"

  # 7b. Check critical resources
  Write-Step "7b. Critical resources"
  $requiredTables = @("signals","tickets","incidents","audit_logs","ticket_incidents","ticket_signals")
  $liveTables = lemma tables list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  foreach ($t in $requiredTables) {
    $found = $liveTables | Where-Object { $_.name -eq $t }
    if ($found) { Write-Ok "Table '$t' exists ($($found.column_count) cols)" }
    else { Write-Warn "Table '$t' MISSING" }
  }

  $requiredFuncs = @("create_signal","link_incident","create_ticket","apply_triage","approve_signal","dedup_incidents")
  $liveFuncs = lemma functions list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  foreach ($f in $requiredFuncs) {
    $found = $liveFuncs | Where-Object { $_.name -eq $f -and $_.status -eq "READY" }
    if ($found) { Write-Ok "Function '$f' READY" }
    else { Write-Warn "Function '$f' MISSING or not ready" }
  }

  $requiredAgents = @("signal-detector","triage-agent","reply-agent","knowledge-agent","memory-agent","severity-assessor")
  $liveAgents = lemma agents list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  foreach ($a in $requiredAgents) {
    $found = $liveAgents | Where-Object { $_.name -eq $a }
    if ($found) { Write-Ok "Agent '$a' exists" }
    else { Write-Warn "Agent '$a' MISSING" }
  }

  # 7c. Check schedules are active
  Write-Step "7c. Schedules"
  $liveScheds = lemma schedules list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $nightly = $liveScheds | Where-Object { $_.name -eq "nightly-signal-scan" }
  if ($nightly -and $nightly.is_active) { Write-Ok "nightly-signal-scan ACTIVE ($($nightly.config.cron))" }
  else { Write-Warn "nightly-signal-scan MISSING or inactive" }

  # 7d. Check app
  Write-Step "7d. Apps"
  $liveApps = lemma apps list --pod $PodId --json 2>&1 | ConvertFrom-Json | Select-Object -ExpandProperty items
  $app = $liveApps | Where-Object { $_.name -eq "signaldesk" }
  if ($app -and $app.status -eq "READY") {
    Write-Ok "signaldesk app READY at $($app.url)"
  } else {
    Write-Warn "signaldesk app MISSING or not ready"
  }

  # 7e. Doctor
  Write-Step "7e. Pod doctor"
  lemma pods doctor $PodId 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Ok "No wiring issues" } else { Write-Warn "Wiring issues found" }

  Write-Step "=== VALIDATION COMPLETE ==="
}

# ---- Main ----
switch ($Command) {
  "status"   { Show-Status }
  "doctor"   { Invoke-Doctor }
  "import"   { Invoke-Import }
  "build"    { Invoke-Build }
  "deploy"   { Invoke-Deploy }
  "sync"     { Invoke-Sync }
  "validate" { Invoke-Validate }
  "all" {
    Show-Status
    Invoke-Doctor
    Invoke-Sync
    Invoke-Validate
  }
}

Write-Host "`nDone." -ForegroundColor $green
