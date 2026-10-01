@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "FIREBASE_PROJECT_ID=quanlysuco-6797e"

if not exist "node_modules\" (
  echo Installing npm packages...
  call npm install
)

echo.
echo === DRY-RUN: chi xem, khong ghi Firestore ===
node migrate-incidents.mjs --dry-run
if errorlevel 1 (
  echo.
  echo Dry-run that bai. Chay: gcloud auth application-default login
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
