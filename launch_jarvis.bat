@echo off
title J.A.R.V.I.S. TERMINAL LAUNCHER
echo =========================================================
echo               J.A.R.V.I.S. INITIALIZATION
echo =========================================================
echo [SYSTEM] Launching local control server...

:: Navigate to backend and start server in background (hidden window/separate task)
cd /d "%~dp0\backend"
start /b node server.js >nul 2>&1

:: Small delay to allow port binding
timeout /t 2 /nobreak >nul

echo [SYSTEM] Launching J.A.R.V.I.S. interface in browser...
start http://localhost:5002

echo =========================================================
echo [READY] J.A.R.V.I.S. is active in your browser.
echo         You can close this terminal window safely.
echo =========================================================
timeout /t 3 >nul
exit
