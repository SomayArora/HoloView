@echo off
echo ========================================
echo HoloView Desktop Build Script
echo ========================================
echo.

echo Installing dependencies...
pip install -r requirements_desktop.txt
echo.

echo Building executable...
pyinstaller --clean HoloView.spec
echo.

echo ========================================
echo Build Complete!
echo Executable: dist\HoloView.exe
echo ========================================
pause
