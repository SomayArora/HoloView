@echo off
echo ========================================
echo HoloView Desktop - Test Run
echo ========================================
echo.

echo Checking dependencies...
pip show pywebview >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements_desktop.txt
)

echo.
echo Starting HoloView Desktop...
python desktop_app.py

pause
