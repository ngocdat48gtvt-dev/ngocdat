# Web Điều hành sự cố V1 (khách hàng)

Cổng điều hành được **gộp vào site bán sản phẩm** (`website/`), không nằm trong `license-admin`.

## Ba web

| App | URL / Port | Ai dùng |
|-----|------------|---------|
| `website/` | `quanlysuco-road.vercel.app` | Quảng cáo sản phẩm + menu **Điều hành** |
| `website/dieu-hanh/` | `/dieu-hanh/` trên cùng domain | Lãnh đạo ADMIN + hạt trưởng USER |
| `license-admin` | 5173 / Vercel riêng | Bạn — cấp license, `companyId`, `role` |

## Build điều hành vào website

```bash
cd website
build-dieu-hanh.bat
git add dieu-hanh
git commit -m "Deploy cổng điều hành"
git push
```

## Dev local (source React)

```bash
cd dieu-hanh-web
npm run start
```

Mở: http://127.0.0.1:5174/dieu-hanh/ (khi `base: '/dieu-hanh/'`)

## Đăng nhập (dieu-hanh-web)

| Role | Quyền |
|------|--------|
| **ADMIN** | 1 / công ty — xem mọi sự cố cùng `companyId`, danh mục, xuất file |
| **USER** | Nhiều / công ty — chỉ sự cố của chính UID trên app |

Yêu cầu: `active: true`, `companyId` không rỗng (gán trong license-admin).

## Routes

| URL | Màn hình |
|-----|----------|
| `/` | Dashboard |
| `/operations` | Bảng điều hành (sắp lý trình) |
| `/catalog` | Danh mục (chỉ ADMIN) |

## Cấp tài khoản (license-admin)

Khi tạo/sửa license: **Mã công ty**, **Tên công ty**, **Vai trò** (`ADMIN` / `USER`).

## Firestore

Publish `firestore.rules` — `isGlobalSeller` (email bạn) khác `isCompanyAdmin` (role ADMIN + companyId).

## Danh mục chung

`.env` tùy chọn:

```
VITE_CATALOG_UID=<uid_ADMIN_công_ty>
```

Đọc `users/{uid}/master_data/{roads|groups|types}`.
