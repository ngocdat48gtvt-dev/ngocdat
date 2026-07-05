@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Build Print QLCL (.exe)
echo ========================================
echo.

pip install -r requirements.txt pyinstaller
if errorlevel 1 (
    echo LOI: Khong cai duoc thu vien.
    pause
    exit /b 1
)

python -m PyInstaller --noconfirm PrintControlPRO.spec
if errorlevel 1 (
    echo LOI: Build that bai.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  XONG!
echo  File gui khach: dist\Print QLCL.exe
echo ========================================
echo.
echo Luu y gui khach:
echo  - Can cai Microsoft Excel tren may
echo  - Cap quyen allowedApps: print_control tren License Admin
echo.
pause
