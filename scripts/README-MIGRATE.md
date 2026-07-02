# Chạy migration Firestore (Windows)

## 1. Tải file Service Account

1. [Firebase Console](https://console.firebase.google.com) → chọn project
2. **Project settings** (bánh răng) → **Service accounts**
3. **Generate new private key** → lưu file `.json` (ví dụ `Downloads\quanlysuco-firebase-adminsdk.json`)

Không commit file này lên Git.

## 2. Cách chạy (khuyến nghị)

1. Mở `run-migrate.cmd` bằng Notepad
2. Sửa dòng `KEY_FILE=...` thành đường dẫn thật tới file JSON
3. Double-click `run-migrate.cmd`

Script sẽ: dry-run trước → hỏi `y` → ghi Firestore.

## 3. Chạy tay — CMD (Command Prompt)

**Không** dùng `$env:` và **không** dùng dòng `#` — đó là PowerShell/bash.

```cmd
cd C:\Users\PC\AndroidStudioProjects\QuanLySuCo\scripts
npm install

set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\PC\Downloads\ten-file-that.json

node migrate-incidents.mjs --dry-run
node migrate-incidents.mjs
```

## 4. Chạy tay — PowerShell

```powershell
cd C:\Users\PC\AndroidStudioProjects\QuanLySuCo\scripts
npm install

$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\PC\Downloads\ten-file-that.json"

node migrate-incidents.mjs --dry-run
node migrate-incidents.mjs
```

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `Unable to detect a Project Id` | Chưa `set` đúng `GOOGLE_APPLICATION_CREDENTIALS` hoặc file JSON sai |
| `The filename... syntax is incorrect` | Đang dùng `$env:` trong CMD — dùng `set` |
| `'#' is not recognized` | CMD không có comment `#` — bỏ các dòng đó |
| `Không tìm thấy file key` | Đổi `C:\path\to\...` thành đường dẫn file thật |

## Trước khi chạy

Trong **license-admin**, gán `companyId` + `role` cho khách — migration sẽ copy `companyId` từ user sang sự cố khi incident chưa có.
