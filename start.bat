@echo off
setlocal
title MH Music - Digital Vinyl Collection
cd /d "%~dp0"

set "BUNDLED_NODE=%~dp0.tools\node"
where node >nul 2>nul
if %ERRORLEVEL%==0 (
  echo [MH Music] Using system Node.js
) else if exist "%BUNDLED_NODE%\node.exe" (
  set "PATH=%BUNDLED_NODE%;%PATH%"
  echo [MH Music] Using bundled Node.js at "%BUNDLED_NODE%"
) else (
  echo [MH Music] Node.js was not found. Install Node 18+ from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [MH Music] Installing dependencies ^(first run, this can take a minute^)...
  call npm install --no-audit --no-fund || (
    echo [MH Music] Retrying with the npmmirror registry...
    call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
  )
  if not exist "node_modules" (
    echo [MH Music] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo [MH Music] Starting the player at http://localhost:5180
echo [MH Music] Press Ctrl+C to stop.
echo.
start "" http://localhost:5180
call npm run dev
endlocal
