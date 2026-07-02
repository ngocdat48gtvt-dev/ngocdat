@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "KEY_FILE=%~dp0..\quanlysuco-6797e-firebase-adminsdk-fbsvc-47f6dc4fa5.json"
if not exist "%KEY_FILE%" (
  echo [LOI] Khong tim thay service account key: %KEY_FILE%
  pause
  exit /b 1
)
set "GOOGLE_APPLICATION_CREDENTIALS=%KEY_FILE%"

if not exist "node_modules\" call npm install

echo.
echo === Fix du lieu cu: Do Van Quang - cong ty cty2 ===
echo Email: quang01121988@gmail.com
echo.

node migrate-incidents.mjs --dry-run --email=quang01121988@gmail.com
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
set /p CONFIRM=Ghi len Firestore? (y/N): 
if /i not "%CONFIRM%"=="y" (
  echo Da huy.
  pause
  exit /b 0
)

node migrate-incidents.mjs --email=quang01121988@gmail.com
echo.
echo Xong. Mo web dieu hanh - Tai lai - chon Tat ca nhan su.
pause
