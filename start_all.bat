@echo off
title Thiruvalluvar Voice AI Launcher
color 0B

echo ============================================================
echo   Thiruvalluvar Voice AI - Full System Launcher
echo ============================================================
echo.

set "BACKEND_DIR=%~dp0"

:: 1. Start NestJS Backend
echo [1/4] Starting Backend API (Knowledge Engine + TTS) on port 3000...
start "Thiruvalluvar Backend [Port 3000]" cmd /k "cd /d "%BACKEND_DIR%" && echo Starting NestJS API... && npm run start"

:: 2. Start Voice Gateway Server (STT + Audio Gateway)
echo [2/4] Starting Voice Gateway (AI4Bharat Tamil STT) on port 8000...
if exist "%BACKEND_DIR%\stt-test\.venv311\Scripts\activate.bat" (
    start "Thiruvalluvar Voice Gateway [Port 8000]" cmd /k "cd /d "%BACKEND_DIR%\stt-test" && call .venv311\Scripts\activate.bat && echo Starting Voice AI Gateway... && python voice_server.py"
) else (
    echo [WARNING] .venv311 not found in stt-test. Run setup_environment.ps1 first!
)

:: 3. Start Cloudflare Tunnel for ESP32 sharing
echo [3/4] Starting Cloudflare Tunnel for ESP32 remote sharing...
start "Thiruvalluvar Cloudflare Tunnel [ESP32 Public Link]" cmd /k "echo Starting Cloudflare Tunnel... && cloudflared tunnel --url http://localhost:8000"

:: 4. Launch Frontend Web UI
echo [4/4] Opening Web Chat Frontend in browser...
echo Waiting 6 seconds for backend initialization...
timeout /t 6 /nobreak >nul

if exist "%BACKEND_DIR%\index.html" (
    start "" "%BACKEND_DIR%\index.html"
)

echo.
echo ============================================================
echo   Services are running!
echo ============================================================
echo   * Backend API:       http://localhost:3000
echo   * Voice Gateway:     http://localhost:8000
echo   * Cloudflare Tunnel: Look at the "Cloudflare Tunnel" window
echo                        Copy the https://xxx.trycloudflare.com link
echo                        and paste it into your ESP32 code!
echo   * Web Frontend:      Opened in your default browser
echo.
echo Keep the opened terminal windows running in the background.
echo To stop everything, close the windows or run stop_all.bat.
echo.
echo Press any key to close this launcher window...
pause >nul
