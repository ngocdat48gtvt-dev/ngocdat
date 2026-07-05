@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Dang chay Print Control...
python main.py
if errorlevel 1 (
    echo.
    echo LOI - xem thong bao phia tren.
    pause
)
