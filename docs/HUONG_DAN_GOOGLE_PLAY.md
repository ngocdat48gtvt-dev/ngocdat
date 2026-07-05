# Đăng app Quản lý sự cố đường bộ lên Google Play

## 1. Tài khoản nhà phát triển

1. Vào [Google Play Console](https://play.google.com/console) — phí đăng ký **$25** (một lần).
2. Tạo **ứng dụng mới** → tên hiển thị (ví dụ: *Quản lý sự cố đường bộ*).

## 2. Tạo keystore ký app (chỉ làm một lần, giữ file cẩn thận)

**Android Studio:** `Build` → `Generate Signed App Bundle / APK` → `Android App Bundle` → `Create new...`

Hoặc dòng lệnh (đổi thông tin cho bạn):

```bat
keytool -genkey -v -keystore quanlysuco-release.jks -alias quanlysuco -keyalg RSA -keysize 2048 -validity 10000
```

Sao lưu file `.jks` và mật khẩu — **mất là không cập nhật được app trên Play**.

## 3. Cấu hình ký trong project

1. Copy `keystore.properties.example` → `keystore.properties` (ở thư mục gốc project).
2. Điền đường dẫn `.jks` và mật khẩu thật.
3. File `keystore.properties` và `*.jks` **không** đưa lên Git.

## 4. Build file AAB (bắt buộc cho Play)

```bat
cd c:\Users\PC\AndroidStudioProjects\QuanLySuCo
gradlew.bat bundleRelease
```

File upload: `app\build\outputs\bundle\release\app-release.aab`

Trong Android Studio: `Build` → `Generate Signed Bundle / APK` → **Android App Bundle** → chọn keystore → **release**.

## 5. Trên Play Console — bắt buộc

| Mục | Gợi ý cho app này |
|-----|-------------------|
| **Quyền riêng tư (URL)** | Trang web mô tả thu thập: email đăng nhập, vị trí (thời tiết), ảnh sự cố, micro (nhập giọng). Bắt buộc có URL công khai. |
| **Data safety** | Khai báo: Location (thời tiết), Photos (sự cố), Email (Firebase Auth), dữ liệu lưu Firebase + máy. |
| **Ảnh chụp màn hình** | Ít nhất 2 ảnh phone (1080×1920 hoặc tỉ lệ tương đương). |
| **Icon 512×512** | Xuất từ `ic_launcher` hoặc thiết kế riêng. |
| **Feature graphic** | 1024×500 (banner store). |
| **Mô tả ngắn / đầy đủ** | Tiếng Việt, nêu quản lý sự cố đường bộ, offline 24h, đồng bộ cloud. |
| **Danh mục** | Doanh nghiệp / Công cụ / Sản xuất (tùy chọn phù hợp). |
| **Nội dung** | Khai báo đúng (không phải app trẻ em nếu không nhắm đối tượng đó). |

## 6. Kiểm tra kỹ thuật trước khi gửi duyệt

- [ ] Đăng nhập Firebase hoạt động trên bản **release**.
- [ ] Firestore Rules đã publish (`firestore.rules`).
- [ ] Tài khoản test: `users/{uid}` có `active: true` và `expireDate`.
- [ ] Thử cài AAB lên máy thật (internal testing).
- [ ] Mỗi lần upload mới: tăng `versionCode` trong `app/build.gradle.kts` (2, 3, 4…).

## 7. Quy trình phát hành khuyến nghị

1. **Internal testing** — gửi link cho vài người trong team.
2. **Closed testing** — công trường thử 1–2 tuần.
3. **Production** — phát hành 100% hoặc rollout từng bước.

## 8. Lưu ý

- **applicationId** hiện tại: `com.tuanduong.quanlysuco` — không đổi sau khi đã lên Play.
- App dùng **Firebase** — cùng package name phải có trong Firebase Console.
- Có **vị trí, camera, micro** → Play sẽ hỏi chi tiết trong form Data safety.
