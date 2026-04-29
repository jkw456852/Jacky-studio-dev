@echo off
setlocal

cd /d "%~dp0"
title XC-STUDIO Quick Start - 3001

echo.
echo [XC-STUDIO] Preparing to start the dev site...
echo [XC-STUDIO] Project directory: %cd%
echo [XC-STUDIO] Fixed port: 3001
echo.

if not exist "node_modules" (
  echo [XC-STUDIO] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo [XC-STUDIO] Dependency install failed. Startup aborted.
    pause
    exit /b 1
  )
)

echo [XC-STUDIO] Starting website...
echo [XC-STUDIO] Open in browser: http://127.0.0.1:3001
echo.

call npm run dev -- --host 127.0.0.1 --port 3001

if errorlevel 1 (
  echo.
  echo [XC-STUDIO] Startup failed. Please check the error output above.
  pause
  exit /b 1
)
