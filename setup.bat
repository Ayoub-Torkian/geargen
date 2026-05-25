@echo off
REM Geargen — one-shot setup: init repo, create on GitHub, push, enable Pages.
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo === Geargen setup ===
echo Folder: %CD%
echo.

REM ---- 1. Check git ----
where git >nul 2>nul
if errorlevel 1 (
  echo [X] git is not installed.
  echo     Install from: https://git-scm.com/download/win
  pause & exit /b 1
)

REM ---- 2. Check gh (GitHub CLI) ----
where gh >nul 2>nul
if errorlevel 1 (
  echo [X] GitHub CLI (gh) is not installed.
  echo     Install from: https://cli.github.com/
  echo     Or via winget:  winget install --id GitHub.cli
  pause & exit /b 1
)

REM ---- 3. Check gh auth ----
gh auth status >nul 2>nul
if errorlevel 1 (
  echo [!] You need to log in to GitHub. Launching browser login...
  gh auth login -h github.com -p https -w
  if errorlevel 1 (
    echo Login failed. Try again.
    pause & exit /b 1
  )
)

REM ---- 4. Clean any partial .git from earlier attempts ----
if exist .git (
  echo Removing existing .git directory...
  rmdir /s /q .git
)

REM ---- 5. Init repo and first commit ----
echo Initializing git repository...
git init -b main >nul || goto :err
git config user.email "torkiangm2@gmail.com"
git config user.name "Ayoub"
git add -A
git commit -m "Initial scaffold: gear template generator" >nul || goto :err

REM ---- 6. Create the GitHub repo AND push in one step ----
echo Creating https://github.com/torkiangm/geargen and pushing...
gh repo create torkiangm/geargen --public --source=. --remote=origin --push || goto :err

REM ---- 7. Enable GitHub Pages from main / root ----
echo Enabling GitHub Pages...
gh api -X POST /repos/torkiangm/geargen/pages -f "source[branch]=main" -f "source[path]=/" >nul 2>nul

REM ---- 8. Show the deployed URL (may take ~30s to go live) ----
echo.
echo ============================================================
echo  DONE. Your site will be live in ~30 seconds at:
echo    https://torkiangm.github.io/geargen/
echo  Repo:
echo    https://github.com/torkiangm/geargen
echo ============================================================
echo.
pause
exit /b 0

:err
echo.
echo ERROR — see message above.
pause
exit /b 1
