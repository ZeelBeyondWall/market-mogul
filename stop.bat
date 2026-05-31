@echo off
echo Killing Market Mogul windows...
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Engine*"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Gateway*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MarketMogul-Client*"  >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":5173 :8787 :8788"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo Done.
exit /b 0
