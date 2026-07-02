# Web Điều hành sự cố đường bộ

Web riêng cho **khách hàng** (công ty mua app), không dùng chung `license-admin` (người bán app).

## Mô hình

| Vai trò | Số lượng | Quyền |
|---------|----------|--------|
| **ADMIN** | 1+ / công ty (danh mục chung → admin chính) | Xem toàn bộ sự cố cùng `companyId`, danh mục, xuất Excel/Word |
| **USER** | Nhiều / công ty | Chỉ xem sự cố do mình tạo trên app |

Tách dữ liệu bằng field `companyId` trên `users/{uid}` và mỗi `incident`.

## Cài đặt

```bash
cd dieu-hanh-web
cp ../license-admin/.env .env   # cùng Firebase project
npm install
npm run dev
```

Mở: http://127.0.0.1:5174

## Cấu hình tài khoản (bạn — người bán app)

Trong **license-admin**, khi tạo/sửa license:

- **Mã công ty** (`companyId`): ví dụ `ql37-2026`
- **Tên công ty** (`companyName`)
- **Vai trò**: `ADMIN` cho lãnh đạo, `USER` cho hạt trưởng

Mỗi công ty: **một admin chính** (tài khoản ADMIN tạo sớm nhất, hoặc `catalogOwnerUid` trên admin phụ). Nhiều `USER`.

## Firestore

Publish `firestore.rules` ở root repo (đã tách `isGlobalSeller` vs `isCompanyAdmin`).

## Port

- `license-admin`: 5173 — bán app
- `dieu-hanh-web`: 5174 — điều hành công ty
