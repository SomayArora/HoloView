@echo off
title HoloView Desktop - Launcher
color 0B
cls

echo.
echo ========================================
echo      HOLOVIEW DESKTOP LAUNCHER
echo ========================================
echo.
echo What would you like to do?
echo.
echo 1. Test Desktop App (Quick Run)
echo 2. Build .exe File (For Distribution)
echo 3. Run Web Version (Browser)
echo 4. Exit
echo.
echo ========================================
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto test
if "%choice%"=="2" goto build
if "%choice%"=="3" goto web
if "%choice%"=="4" goto exit

echo Invalid choice. Please try again.
pause
goto start

:test
cls
echo.
echo ========================================
echo   Testing Desktop App...
echo ========================================
echo.
call run_desktop.bat
goto end

:build
cls
echo.
echo ========================================
echo   Building HoloView.exe...
echo ========================================
echo.
call build_desktop.bat
goto end

:web
cls
echo.
echo ========================================
echo   Starting Web Version...
echo ========================================
echo.
echo The app will open in your browser.
echo Press Ctrl+C to stop the server.
echo.
python backend.py
goto end

:exit
exit

:end
echo.
echo Press any key to return to menu...
pause >nul
cls
goto start
