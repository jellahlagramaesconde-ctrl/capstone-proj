@echo off
title JORS COSCA System Launcher
echo ===================================================
echo   Starting Colegio de Santa Catalina de Alejandria
echo         JORS COSCA Facilities Control System
echo ===================================================
echo.
echo Starting Frontend and Backend servers concurrently...
echo Keep the new window open.
echo.

start "JORS COSCA Servers" cmd /k "cd /d "%~dp0" && npm run dev"

echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo Launching Web Browser at http://127.0.0.1:5173 ...
start http://127.0.0.1:5173