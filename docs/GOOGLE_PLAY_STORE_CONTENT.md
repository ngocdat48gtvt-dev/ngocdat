# Google Play — Bộ nội dung đăng CH Play

**App:** Quản lý sự cố đường bộ  
**Package:** `com.tuanduong.quanlysuco`  
**Phiên bản đầu:** 1.0.0 (versionCode 1)

> Thay `[EMAIL_HỖ_TRỢ]` và `[TÊN_TỔ_CHỨC]` trước khi publish.  
> Privacy Policy HTML: `docs/PRIVACY_POLICY.html` → host lên Google Sites / website → dán URL vào Console.

---

## 1. Tên ứng dụng (≤ 30 ký tự)

```
Quản lý sự cố đường bộ
```

---

## 2. Mô tả ngắn / Short description (≤ 80 ký tự)

**Bản chính (79 ký tự):**

```
Ghi sự cố đường bộ, ảnh hiện trường, báo cáo Word/Excel, đồng bộ cloud, offline 24h.
```

**Bản thay thế (76 ký tự):**

```
Quản lý sự cố đường: chụp ảnh, thống kê, xuất báo cáo, đồng bộ Firebase, dùng offline.
```

---

## 3. Mô tả đầy đủ / Full description (≤ 4000 ký tự)

```
Quản lý sự cố đường bộ — ứng dụng chuyên dụng cho đội hiện trường, kỹ sư và đơn vị quản lý / thi công đường bộ. Ghi nhận sự cố nhanh, có ảnh minh chứng, báo cáo chuẩn và đồng bộ cloud — vẫn làm việc được khi sóng yếu nhờ chế độ offline 24 giờ.

■ VÌ SAO CHỌN APP NÀY?
• Thiết kế cho công trường: thao tác rõ ràng, ít bước, tiếng Việt
• Ảnh trước / sau sự cố gắn với từng vị trí lý trình
• Xuất báo cáo Word và Excel kèm hình — sẵn sàng trình bày
• Đồng bộ Firebase khi có mạng; không bắt buộc online liên tục

■ TÍNH NĂNG CHÍNH

Đăng nhập & bảo mật
• Tài khoản do quản trị viên cấp (email / mật khẩu)
• Kiểm tra license và giới hạn thiết bị đăng nhập
• Sau khi xác thực online: dùng app trong 24 giờ không cần mạng liên tục

Ghi nhận sự cố
• Tuyến đường, nhóm, loại sự cố, lý trình (km), phía đường
• Kích thước (dài, rộng, cao), khối lượng, đơn vị
• Ghi chú; nhập nhanh bằng giọng nói (tùy chọn)
• Chụp ảnh hoặc chọn từ thư viện — ảnh trước và sau xử lý

Quản lý & tra cứu
• Danh sách sự cố, lọc theo ngày / tuyến / loại
• Tìm kiếm theo km, tuyến, loại sự cố
• Xem chi tiết, cập nhật, xóa (đồng bộ cloud khi có mạng)

Báo cáo & xuất file
• Thống kê theo bộ lọc
• Xuất Excel
• Xuất Word có ảnh minh họa — phù hợp báo cáo hiện trường / thanh tra

Đồng bộ & tiện ích
• Đồng bộ dữ liệu và ảnh lên Firebase
• Thời tiết khu vực trên màn hình chính (cần quyền vị trí — tùy chọn)
• Tải dữ liệu từ cloud khi đăng nhập lần đầu trên thiết bị mới

■ AI NÊN DÙNG?
• Đơn vị quản lý, giám sát, thi công đường bộ
• Kỹ sư hiện trường cần báo cáo có ảnh và số liệu thống nhất
• Đội ghi nhận sự cố sau mưa lũ, sạt lở, hư hỏng mặt đường

■ YÊU CẦU
• Android 8.0 trở lên
• Tài khoản được cấp bởi quản trị viên tổ chức
• Internet để đăng nhập lần đầu và đồng bộ định kỳ (tối thiểu mỗi 24 giờ)

■ HỖ TRỢ
Email: [EMAIL_HỖ_TRỢ]
Đơn vị: [TÊN_TỔ_CHỨC]

Cảm ơn bạn đã tin dùng Quản lý sự cố đường bộ!
```

---

## 4. Data Safety — Câu trả lời Play Console

Điền tại: **App content → Data safety**. Form Google có thể đổi nhãn — dùng bảng dưới làm chuẩn nội dung.

### 4.1. Ứng dụng có thu thập hoặc chia sẻ dữ liệu người dùng không?

**Có**

### 4.2. Dữ liệu có được mã hóa khi truyền không?

**Có** — dữ liệu được mã hóa khi truyền (HTTPS / TLS, Firebase).

### 4.3. Người dùng có thể yêu cầu xóa dữ liệu không?

**Có** — qua quản trị viên tổ chức (Firestore) hoặc đăng xuất để xóa dữ liệu trên máy.

### 4.4. Cam kết quyền riêng tư (nếu có)

**Không** đăng ký cam kết bổ sung ngoài chính sách riêng tư của bạn.

### 4.5. Chi tiết từng loại dữ liệu

#### Personal info → Email address

| Câu hỏi | Trả lời |
|---------|---------|
| Thu thập / chia sẻ? | Thu thập — Có thể chia sẻ với nhà cung cấp dịch vụ (Google Firebase) |
| Bắt buộc hay tùy chọn? | **Bắt buộc** (không thể đăng nhập nếu không có) |
| Mục đích | App functionality, Account management |
| Ephemeral? | Không |

#### Photos and videos → Photos

| Câu hỏi | Trả lời |
|---------|---------|
| Thu thập / chia sẻ? | Thu thập — Có thể qua Firebase Storage |
| Bắt buộc? | **Tùy chọn** (chỉ khi người dùng chụp/chọn ảnh) |
| Mục đích | App functionality |
| Ephemeral? | Không |

#### Location → Precise location

| Câu hỏi | Trả lời |
|---------|---------|
| Thu thập / chia sẻ? | Thu thập — Có thể gửi tọa độ tới Open-Meteo (thời tiết) |
| Bắt buộc? | **Tùy chọn** (từ chối quyền vị trí vẫn dùng được app) |
| Mục đích | App functionality |
| Ephemeral? | Không (cache thời tiết trên phiên) |

#### App activity → Other user-generated content

| Câu hỏi | Trả lời |
|---------|---------|
| Mô tả | Dữ liệu sự cố: tuyến, km, loại, kích thước, ghi chú, báo cáo |
| Thu thập / chia sẻ? | Thu thập — Firebase Firestore |
| Bắt buộc? | **Bắt buộc** cho chức năng chính |
| Mục đích | App functionality |

#### Audio → Voice or sound recordings

| Câu hỏi | Trả lời |
|---------|---------|
| Thu thập / chia sẻ? | Thu thập (xử lý trên thiết bị / dịch vụ nhận dạng giọng của hệ thống) |
| Bắt buộc? | **Tùy chọn** |
| Mục đích | App functionality |
| Ephemeral? | **Có** — không lưu file âm thanh lâu dài trên server app |

#### Device or other IDs → Device or other IDs

| Câu hỏi | Trả lời |
|---------|---------|
| Thu thập / chia sẻ? | Thu thập — Firebase (phiên thiết bị) |
| Bắt buộc? | **Bắt buộc** (quản lý license / giới hạn thiết bị) |
| Mục đích | App functionality, Fraud prevention, security |

### 4.6. Dữ liệu KHÔNG thu thập (chọn “No” nếu form hỏi)

- Thông tin tài chính / thanh toán  
- Sức khỏe / thể chất  
- Tin nhắn SMS, cuộc gọi  
- Danh bạ  
- Lịch sử duyệt web  
- Quảng cáo / tracking đa nền tảng  

### 4.7. Link chính sách quyền riêng tư

URL sau khi host file `docs/PRIVACY_POLICY.html`:

```
https://[DOMAIN-CUA-BAN]/privacy-policy.html
```

---

## 5. Từ khóa ASO tiếng Việt

**Lưu ý:** Google Play không còn ô “keywords” riêng; dùng các cụm này trong **tên phụ / mô tả / screenshot caption** và chiến dịch quảng cáo.

### 5.1. Từ khóa chính (high intent)

```
quản lý sự cố đường bộ
ghi nhận sự cố đường
báo cáo sự cố đường
app quản lý sự cố
sự cố giao thông đường bộ
hiện trường đường bộ
```

### 5.2. Từ khóa tính năng

```
chụp ảnh sự cố
báo cáo word sự cố
xuất excel sự cố
đồng bộ cloud đường bộ
quản lý công trình đường
lý trình km
thống kê sự cố
```

### 5.3. Từ khóa bối cảnh / ngành

```
quản lý thi công đường
giám sát đường bộ
sạt lở đường
mưa lũ đường bộ
bảo trì đường bộ
kỹ sư hiện trường
công trình giao thông
```

### 5.4. Từ khóa long-tail (ít cạnh tranh hơn)

```
app ghi sự cố offline
quản lý sự cố có ảnh
báo cáo hiện trường đường bộ
phần mềm quản lý sự cố android
```

### 5.5. Cụm gợi ý cho screenshot / feature graphic (caption)

```
Thêm sự cố trong 1 phút
Ảnh trước – sau minh chứng
Xuất Word & Excel có hình
Làm việc khi mất sóng 24h
Đồng bộ Firebase an toàn
```

### 5.6. Tránh (không liên quan / vi phạm chính sách)

```
game, dating, crypto, hack, crack, mod apk, spam
```

---

## 6. Release notes — Ghi chú phiên bản

### 6.1. Tiếng Việt (Production — version 1.0.0)

```
🎉 Ra mắt phiên bản 1.0.0

• Đăng nhập tài khoản được cấp, kiểm tra license
• Thêm / sửa / xóa sự cố: tuyến, lý trình, loại, kích thước, ghi chú
• Chụp ảnh trước & sau, chọn ảnh từ thư viện
• Danh sách sự cố: lọc, tìm kiếm, xem chi tiết
• Báo cáo thống kê; xuất Excel và Word kèm ảnh
• Đồng bộ dữ liệu & ảnh lên Firebase
• Chế độ offline: dùng app trong 24h sau khi xác thực online (phù hợp công trường)
• Thời tiết khu vực trên màn hình chính
• Nhập liệu bằng giọng nói (tùy chọn)

Cần tài khoản do quản trị viên cấp. Hỗ trợ: [EMAIL_HỖ_TRỢ]
```

### 6.2. Tiếng Anh (tùy chọn — nếu bật listing EN)

```
Version 1.0.0 — Initial release

• Account login and license verification
• Create, edit, and manage road incidents with photos
• Export reports to Word and Excel
• Firebase cloud sync
• Offline mode for up to 24 hours after online verification
• Optional voice input and local weather

Account required from your administrator.
```

### 6.3. Mẫu cho bản cập nhật sau (1.0.1+)

```
• Sửa lỗi đồng bộ khi mạng yếu
• Cải thiện tải thời tiết khi có 4G/Wi‑Fi
• Tối ưu xuất báo cáo Word
• Ổn định đăng nhập và license offline
```

---

## 7. Checklist trước khi bấm Publish

- [ ] Host `PRIVACY_POLICY.html` → dán URL vào Console  
- [ ] Upload AAB: `app/build/outputs/bundle/release/app-release.aab`  
- [ ] Icon 512, feature graphic 1024×500, ≥ 2 screenshot  
- [ ] Điền Data safety theo mục 4  
- [ ] Thay placeholder email / tên tổ chức  
- [ ] Test internal track với tài khoản `active: true` trên Firestore  
