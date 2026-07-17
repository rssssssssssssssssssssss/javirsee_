@echo off
title STOP J.A.R.V.I.S.
echo =========================================================
echo             STOPPING J.A.R.V.I.S. BACKGROUND CORE
echo =========================================================
taskkill /f /im python.exe /im pythonw.exe >nul 2>&1
echo [SYSTEM] J.A.R.V.I.S. cores terminated successfully.
echo =========================================================
timeout /t 3
