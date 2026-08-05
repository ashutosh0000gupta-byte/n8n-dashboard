@echo off
echo Starting GlowCare Admin Dashboard Locally...
echo ==============================================

cd /d "%~dp0"

echo [1/3] Checking for dependencies...
call npm install --no-audit --no-fund

echo.
echo [2/3] Starting the Node.js server...
echo The dashboard will be available at http://localhost:10000
echo (Keep this window open to keep the server running!)
echo.

:: Open the browser automatically after a 2 second delay
start "" http://localhost:10000

echo [3/3] Server is running. Press Ctrl+C to stop.
echo ==============================================
node backend_server.js
pause
