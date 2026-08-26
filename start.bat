@echo off
title JORS COSCA System Launcher
echo ===================================================
echo   Starting Colegio de Santa Catalina de Alejandria
echo         JORS COSCA Facilities Control System
echo ===================================================
echo.
echo Starting Backend API Server (Port 4000)...
start "JORS Backend Server" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Starting Frontend Web Portal (Port 5173)...
start "JORS Frontend App" cmd /k "cd /d "%~dp0Frontend" && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Launching Web Browser at http://127.0.0.1:5173 ...
start http://127.0.0.1:5173

echo.
echo ===================================================
echo  System is running! Keep server windows open.
echo ===================================================
