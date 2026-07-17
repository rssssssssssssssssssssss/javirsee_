@echo off
title J.A.R.V.I.S. VOICE CORE TERMINAL
echo =========================================================
echo              J.A.R.V.I.S. INITIALIZATION
echo =========================================================
echo [SYSTEM] Activating Python virtual environment...
call "%~dp0\.venv\Scripts\activate.bat"

echo [SYSTEM] Starting J.A.R.V.I.S. voice core...
python "%~dp0\jarvis.py"

echo =========================================================
echo [OFFLINE] Cores deactivated. Terminal session ended.
echo =========================================================
pause
