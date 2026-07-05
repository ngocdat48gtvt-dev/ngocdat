# Migration: Điều hành sự cố (Firestore)

## Phân tích hiện trạng

### Cấu trúc Firestore
- `users/{uid}/incidents/{incidentId}` — mỗi tài khoản Android một subcollection.
- Field đang dùng (Android + Web): `incidentId`, `uuid`, `code`, `road`, `groupName`, `type`, `date`, `km`, `position`, `dai`, `rong`, `cao`, `unit`, `note`, `deleted`, `beforeImages[]`, `afterImages[]`.

### Luồng Android
- SQLite local (`tuanduong.db`) → `FirebaseSync.uploadIncident()` merge lên Firestore.
- Ảnh: Storage `images/{uid}/{incidentId}/{before|after}/` → `arrayUnion` vào `beforeImages` / `afterImages`.
- License: `users/{uid}.active`, `expireDate`.

### Web hiện có
- `license-admin/` (React + Vite + Firebase) — quản lý license/lead; đã thêm trang **Điều hành sự cố** (`/incidents`).

## Nguyên tắc migration

1. **Chỉ thêm field**, không xóa/đổi tên field cũ.
2. **Merge** (`SetOptions.merge` / `set(..., { merge: true })`) — document cũ không mất dữ liệu.
3. App Android cũ vẫn ghi được; field mới do app mới hoặc script backfill.
4. Khóa 24h: `locked` + rules chặn sửa core fields khi `locked == true`.

## Field mới trên incident

| Field | Mặc định (dữ liệu cũ) |
|--------|------------------------|
| `status` | `NEW` hoặc `PARTIAL` nếu có `afterImages` |
| `progress` | `0` hoặc giá trị cũ; nếu có `afterImages` và chưa có progress thì có thể gán `90` (migration một lần) — sau đó app dùng **0–100% tùy biến** |
| `locked` | `true` nếu đã quá 24h từ `createdAt` hoặc `date` |
| `createdAt` | Parse từ `date` hoặc server timestamp |
| `updatedAt` | server timestamp |
| `createdByName` | `""` |
| `companyId` | `""` |
| `priority` | `NORMAL` |
| `updates` | 1 bản ghi khởi tạo nếu chưa có |

## Field mới trên user

| Field | Mặc định |
|--------|----------|
| `role` | `USER` |
| `companyId` | `""` |

Gán `role: ADMIN` thủ công trên Firebase Console cho tài khoản điều hành (hoặc email trong `firestore.rules`).

## Các bước triển khai

1. **Publish Firestore Rules** — file `firestore.rules` ở root repo (sửa email seller trong `isGlobalSeller()` trước khi deploy).
2. **Deploy indexes** — `firestore.indexes.json` (collection group `incidents`).
3. **Chạy migration** (khuyến nghị `--dry-run` trước):

```bash
cd scripts
npm install
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccount.json
node migrate-incidents.mjs --dry-run
node migrate-incidents.mjs
```

4. **Phát hành app Android** — bản có `IncidentDispatch`, DB v9, sync `updates`.
5. **Deploy Web** — `license-admin`: `npm run build`, deploy Vercel/hosting.

## Kiểm tra sau migration

- [ ] Document cũ vẫn có đủ `road`, `beforeImages`, `afterImages`.
- [ ] App Android cũ (nếu còn) vẫn mở/sửa được (ghi chú, ảnh).
- [ ] Sau 24h không sửa được tuyến/km/loại/kích thước trên app mới.
- [ ] Web Admin đọc được `collectionGroup('incidents')`.
- [ ] Mỗi lần thêm ảnh after / hoàn thành có thêm phần tử `updates` (không ghi đè).

## Rollback

- Không xóa field mới (Firestore merge an toàn).
- Có thể tắt rules khóa bằng bản rules cũ (không khuyến nghị).
- App Android có thể rollback APK; dữ liệu cloud vẫn giữ field mới.
