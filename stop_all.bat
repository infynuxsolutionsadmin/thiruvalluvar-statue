@echo off
title Stop Thiruvalluvar Voice AI
color 0C

echo ============================================================
echo   Stopping Thiruvalluvar Voice AI Services
echo ============================================================
echo.

echo Stopping services on Port 3000 (Backend API)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo Terminating PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo Stopping services on Port 8000 (Voice Gateway)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo Terminating PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo Stopping Cloudflare Tunnel...
taskkill /f /im cloudflared.exe >nul 2>&1

echo.
echo All services and tunnels have been stopped.
timeout /t 3 >nul
