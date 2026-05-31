@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   MARKET MOGUL - launching 3 services
echo   ENGINE :8788  +  GATEWAY :8787  +  CLIENT :5173
echo ============================================
echo.

REM ---- Pre-cleanup ----
echo Cleaning stale processes on :5173 :8787 :8788 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":8787 :8788 :5173"') do (
  taskkill /F /PID %%a >nul 2>&1
)
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Engine*"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Gateway*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Client*"  >nul 2>&1
timeout /t 1 /nobreak >nul

REM Engine first (gateway depends on it). 6s for cold tsx-watch boot.
start "MarketMogul-Engine" cmd /k "cd services\engine && npm run dev"
timeout /t 6 /nobreak >nul

REM Gateway
start "MarketMogul-Gateway" cmd /k "cd services\gateway && npm run dev"
timeout /t 2 /nobreak >nul

REM Client (Vite)
start "MarketMogul-Client" cmd /k "cd client && npm run dev"
timeout /t 4 /nobreak >nul

echo.
echo Opening browser at http://localhost:5173/ ...
start "" "http://localhost:5173/"

echo.
echo All 3 windows running:
echo - MarketMogul-Engine   ( :8788  internal )
echo - MarketMogul-Gateway  ( :8787  client-facing )
echo - MarketMogul-Client   ( :5173  Vite dev )
echo.
echo To stop everything: click STOP ALL in the game UI
echo OR close all windows OR run stop.bat
echo.
exit /b 0
