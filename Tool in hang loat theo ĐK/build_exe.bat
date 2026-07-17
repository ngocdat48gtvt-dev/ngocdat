@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Build Print QLCL (.exe)
echo ========================================
echo.

REM Loai JDK/Java khoi PATH khi build — tranh PyInstaller gom api-ms-win-*.dll sai
for %%P in ("%PATH:;=" "%") do (
  echo %%~P | findstr /I /C:"\jdk" /C:"\jdks" /C:"\java\" >nul
  if errorlevel 1 set "CLEAN_PATH=%%~P;!CLEAN_PATH!"
)
set "PATH=!CLEAN_PATH!"

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
