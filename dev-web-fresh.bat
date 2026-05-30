@echo off
REM Deletes .next then starts Webpack dev — use when you see ENOENT on
REM _buildManifest.js.tmp, missing chunk .js, or stale UI.
setlocal
cd /d "%~dp0"
if not exist .env.local copy /Y .env.example .env.local >nul
echo [dev-web-fresh] Stopping other "next dev" for this folder is recommended.
call npm run dev:fresh
exit /b %ERRORLEVEL%

