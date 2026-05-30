@echo off
REM Turbopack dev (opt-in). If Windows ENOENT errors return, use dev-web.bat instead.
setlocal
cd /d "%~dp0"
if not exist .env.local copy /Y .env.example .env.local >nul
call npm run dev:turbo
exit /b %ERRORLEVEL%

