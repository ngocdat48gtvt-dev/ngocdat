@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM === Sửa dòng dưới: đường dẫn file JSON tải từ Firebase (Service accounts) ===
set "KEY_FILE=%~dp0..\quanlysuco-6797e-firebase-adminsdk-fbsvc-47f6dc4fa5.json"

if not exist "%KEY_FILE%" (
  echo.
  echo [LOI] Khong tim thay file key:
  echo   %KEY_FILE%
  echo.
  echo Mo file run-migrate.cmd bang Notepad, sua bien KEY_FILE cho dung duong dan.
  echo Tai key: Firebase Console - Project settings - Service accounts - Generate new private key
  pause
  exit /b 1
)

set "GOOGLE_APPLICATION_CREDENTIALS=%KEY_FILE%"

if not exist "node_modules\" (
  echo Installing npm packages...
  call npm install
)

echo.
echo === DRY-RUN: chi xem, khong ghi Firestore ===
node migrate-incidents.mjs --dry-run
if errorlevel 1 (
  echo.
  echo Dry-run that bai. Kiem tra KEY_FILE va quyen Service Account.
  pause
  exit /b 1
)

echo.
set /p CONFIRM=Chay that va GHI Firestore? (y/N): 
if /i not "%CONFIRM%"=="y" (
  echo Da huy.
  pause
  exit /b 0
)

node migrate-incidents.mjs
echo.
pause
