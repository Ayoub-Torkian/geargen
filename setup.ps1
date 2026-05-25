# Geargen - one-shot setup. Probes the system, installs anything missing, deploys.
# Run from PowerShell:  .\setup.ps1
# Or right-click the file: "Run with PowerShell"

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Section([string]$t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok([string]$t)      { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Info([string]$t)    { Write-Host "  [..]   $t" -ForegroundColor Gray }
function Warn([string]$t)    { Write-Host "  [!!]   $t" -ForegroundColor Yellow }
function Fail([string]$t)    { Write-Host "  [XX]   $t" -ForegroundColor Red }

function Has-Cmd([string]$n) { $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }

# ---------------------------------------------------------------------------
Section "Probing system"

if (Has-Cmd git) {
    $gitVer = (git --version) -replace 'git version ',''
    Ok "git: $gitVer"
} else {
    Fail "git is NOT installed."
    Write-Host "        Install from https://git-scm.com/download/win and re-run." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

$hasGh = Has-Cmd gh
if ($hasGh) {
    $ghVer = (gh --version | Select-Object -First 1)
    Ok "gh:  $ghVer"
} else {
    Warn "gh (GitHub CLI) is NOT installed."
}

$hasWinget = Has-Cmd winget
if ($hasWinget) { Ok "winget available (can auto-install gh if needed)" }

# ---------------------------------------------------------------------------
if (-not $hasGh) {
    Section "Installing GitHub CLI"
    if ($hasWinget) {
        Info "Running: winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements"
        winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements
        # Refresh PATH for current session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        if (-not (Has-Cmd gh)) {
            Fail "gh still not on PATH after install. Close this PowerShell window, open a new one, and re-run setup.ps1."
            Read-Host "Press Enter to exit"; exit 1
        }
        Ok "gh installed."
    } else {
        Fail "winget unavailable. Install gh manually from https://cli.github.com/ then re-run."
        Read-Host "Press Enter to exit"; exit 1
    }
}

# ---------------------------------------------------------------------------
Section "Checking GitHub authentication"
$authOk = $true
try { gh auth status 2>$null | Out-Null; if ($LASTEXITCODE -ne 0) { $authOk = $false } }
catch { $authOk = $false }

if ($authOk) {
    Ok "Already authenticated to GitHub."
} else {
    Warn "Not authenticated. Launching browser login..."
    gh auth login -h github.com -p https -w
    if ($LASTEXITCODE -ne 0) { Fail "Login failed."; Read-Host "Press Enter to exit"; exit 1 }
    Ok "Authenticated."
}

$me = (gh api user --jq .login 2>$null)
if ($me) {
    Ok "Logged in as $me."
} else {
    Fail "Couldn't read GitHub user. Run 'gh auth status' and try again."
    Read-Host "Press Enter to exit"; exit 1
}
$repoSlug = "$me/geargen"

# ---------------------------------------------------------------------------
Section "Preparing local repo"

if (Test-Path .git) {
    Info "Removing existing .git (partial init from earlier)..."
    Remove-Item -Recurse -Force .git
}

git init -b main | Out-Null
git config user.email "torkiangm2@gmail.com"
git config user.name "Ayoub"
git add -A
git commit -m "Initial scaffold: gear template generator" | Out-Null
Ok "Committed initial scaffold."

# ---------------------------------------------------------------------------
Section "Creating GitHub repo and pushing"

# Does the repo already exist?
$exists = $false
gh repo view $repoSlug 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $exists = $true }

if ($exists) {
    Info "Repo $repoSlug already exists on GitHub. Linking and pushing..."
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$repoSlug.git"
    git push -u origin main --force
} else {
    Info "Creating https://github.com/$repoSlug ..."
    gh repo create $repoSlug --public --source=. --remote=origin --push
}
if ($LASTEXITCODE -ne 0) { Fail "Push failed."; Read-Host "Press Enter to exit"; exit 1 }
Ok "Code pushed to $repoSlug."

# ---------------------------------------------------------------------------
Section "Enabling GitHub Pages"

# Try to enable Pages on main / root. Ignore "already enabled" errors.
$response = gh api -X POST "repos/$repoSlug/pages" -f 'source[branch]=main' -f 'source[path]=/' 2>&1

if ($LASTEXITCODE -eq 0) {
    Ok "Pages enabled."
} elseif ($response -match 'already exists' -or $response -match '409') {
    Ok "Pages was already enabled."
} else {
    Warn "Pages API response: $response"
    Warn "If Pages isn't live in 1 minute, enable it manually: repo Settings -> Pages -> Branch: main, Folder: /(root)."
}

# ---------------------------------------------------------------------------
Section "Done"
Write-Host ""
Write-Host "  Repo:  https://github.com/$repoSlug" -ForegroundColor White
Write-Host "  Site:  https://$me.github.io/geargen/  (live in ~30 seconds)" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
