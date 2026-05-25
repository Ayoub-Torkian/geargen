# Geargen - one-click commit + push.
# Stages everything, commits with a message you type (or a default), pushes to origin/main.

Set-Location -Path $PSScriptRoot

# Refresh PATH so gh/git resolve even from a fresh shell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "git is not on PATH. Open a fresh PowerShell window and try again." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

Write-Host ""
Write-Host "=== Changes ===" -ForegroundColor Cyan
git status --short

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"; exit 0
}

$msg = Read-Host "`nCommit message (Enter for default)"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "Update: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

Write-Host ""
Write-Host "=== Committing ===" -ForegroundColor Cyan
git add -A
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Read-Host "Commit failed. Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "=== Pushing ===" -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Read-Host "Push failed. Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "Done. Site will refresh in ~30 seconds at:" -ForegroundColor Green
Write-Host "  https://ayoub-torkian.github.io/geargen/" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
