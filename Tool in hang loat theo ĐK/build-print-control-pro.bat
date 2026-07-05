@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM ============================================================
REM Build Print-Control-PRO.exe — chay TU THU MUC GOC tool
REM (noi co file .py chinh, vi du main.py)
REM Output: dist\Print-Control-PRO.exe
REM KHONG dung rcedit sau build — PyInstaller se hong file!
REM ============================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "ENTRY=main.py"
if not "%~1"=="" set "ENTRY=%~1"

if not exist "%ROOT%%ENTRY%" (
  echo [LOI] Khong tim thay %ENTRY% trong:
  echo   %ROOT%
  echo.
  echo Cach dung:
  echo   1. Copy build-print-control-pro.bat + Print-Control-PRO.ico vao thu muc goc tool
  echo   2. Chay: build-print-control-pro.bat
  echo   3. Hoac chi ro file .py: build-print-control-pro.bat app.py
  pause
  exit /b 1
)

set "ICON=%ROOT%Print-Control-PRO.ico"
if not exist "%ICON%" (
  echo [LOI] Thieu Print-Control-PRO.ico cung thu muc.
  pause
  exit /b 1
)

echo Dang build (icon + dist goc)...
python -m pip install pyinstaller pillow -q
if errorlevel 1 goto :fail

if exist "%ROOT%build" rmdir /s /q "%ROOT%build"
if not exist "%ROOT%dist" mkdir "%ROOT%dist"

pyinstaller --noconfirm --clean ^
  --onefile ^
  --windowed ^
  --name "Print-Control-PRO" ^
  --icon "%ICON%" ^
  --distpath "%ROOT%dist" ^
  --workpath "%ROOT%build" ^
  --specpath "%ROOT%" ^
  "%ENTRY%"
if errorlevel 1 goto :fail

if exist "%ROOT%print_config.json" (
  copy /Y "%ROOT%print_config.json" "%ROOT%dist\print_config.json" >nul
)

echo.
echo OK: %ROOT%dist\Print-Control-PRO.exe
echo Tiep theo: website\copy-in-qlcl-exe.bat
pause
exit /b 0

:fail
echo Build that bai.
pause
exit /b 1
