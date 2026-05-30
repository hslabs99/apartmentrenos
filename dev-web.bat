@echo off
REM Next.js against CLOUD Firestore (uses .env.local — see .env.example). No emulator.
REM
REM Run only ONE dev server for this folder. Two terminals share .next and corrupt builds
REM (missing ./NNN.js, ENOENT _buildManifest.js.tmp.*). Close all other "next dev" first.
REM Default uses Webpack dev (more stable on Windows). Optional: npm run dev:turbo
REM If ENOENT on .next manifests: close dev, run dev-web-fresh.bat or npm run dev:fresh
setlocal
cd /d "%~dp0"
if not exist .env.local copy /Y .env.example .env.local >nul
call npm run dev
exit /b %ERRORLEVEL%
