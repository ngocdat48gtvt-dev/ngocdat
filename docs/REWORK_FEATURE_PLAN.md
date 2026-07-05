# Kế hoạch tính năng: Giao việc bổ sung hồ sơ hiện trường (Rework)

> **Trạng thái:** Kế hoạch **đã xác nhận** — sẵn sàng triển khai theo phase.  
> **Ngày:** 2026-06-11 (cập nhật quyết định stakeholder)  
> **Phạm vi:** App Kotlin (USER) + Web điều hành `dieu-hanh-web` (ADMIN).  
> **Nguyên tắc:** Chỉ **BỔ SUNG**, không đổi logic nghiệp vụ / collection / Storage path hiện có.

---

## 1. Mục tiêu nghiệp vụ

Admin phát hiện ảnh / hồ sơ hiện trường chưa đạt (mờ, thiếu toàn cảnh, sai vị trí, thiếu ảnh sau xử lý…) → **giao việc bổ sung minh chứng** cho User hiện trường.

**Không được thay đổi khi giao việc / bổ sung:**
- Tiến độ (`progress`, logic 0% → 90% → 100%)
- Khối lượng, tuyến, lý trình, loại sự cố
- Xuất Word / Excel / ghép ảnh báo cáo
- Cấu trúc `updates[]` hiện tại (timeline tiến độ app)

**Chỉ bổ sung** quy trình song song: giao việc → User chụp/chọn ảnh + ghi chú → Admin duyệt.

---

## 2. Phân tích hiện trạng (đã đọc source)

### 2.1 Firestore

| Mục | Chi tiết |
|-----|----------|
| Path | `users/{uid}/incidents/{incidentId}` — **giữ nguyên** |
| Collection group | `incidents` — ADMIN đọc theo `companyId` |
| Rules | `firestore.rules` — không validate shape field; core lock chỉ áp `road`, `km`, `groupName`, `type`, `dai`, `rong`, `cao`, `unit`, `date` khi `locked==true` |
| Field `rework` | **Chưa tồn tại** trong repo |

**Kết luận:** Thêm object `rework` (và tùy chọn `reworkHistory[]`) là **merge an toàn** — document cũ không có field vẫn hoạt động; app cũ bỏ qua field lạ.

### 2.2 Web điều hành (`dieu-hanh-web`)

| File | Vai trò |
|------|---------|
| `src/types/incident.ts` | `IncidentRecord`, `IncidentUpdate` |
| `src/services/incidentsService.ts` | `mapDoc`, `updateIncidentRecord` (partial `updateDoc`) |
| `src/hooks/useIncidents.ts` | Realtime `onSnapshot` |
| `src/components/dispatch/IncidentDetailDrawer.tsx` | Popup chi tiết (Dialog) — ảnh trước/sau, timeline |
| `src/components/dispatch/IncidentTimeline.tsx` | Chỉ render `updates[]` (tiến độ app) |
| `src/components/dispatch/IncidentOperationsTable.tsx` | Bảng + mở detail/edit |
| `src/App.tsx` | Routes: `/`, `/operations`, `/catalog` |
| `src/components/layout/AppLayout.tsx` | Sidebar 3 mục |

**Ghi chú quan trọng:**
- Web **không ghi** `beforeImages` / `afterImages` / `updates` hôm nay.
- `updateIncidentRecord` chỉ spread `IncidentPatch` — **không ghi đè** field không gửi.
- Detail **không deep-link URL** — mở từ bảng điều hành.

### 2.3 App Android (Kotlin)

| File | Vai trò |
|------|---------|
| `incident/model/Incident.kt` | Data class SQLite — **không có rework** |
| `incident/data/DatabaseHelper.kt` | DB v11, migration qua `ensureColumn()` |
| `com/tuanduong/FirebaseSync.kt` | Upload `SetOptions.merge()`; pull merge ảnh |
| `com/tuanduong/sync/IncidentDispatch.kt` | `status`, `progress`, `updates[]`, core lock |
| `AddIncidentActivity.kt` | Tạo/sửa sự cố + ảnh before/after |
| `IncidentDetailActivity.kt` | Xem ảnh, tiến độ — **không chụp ảnh mới** |
| `MainActivity.kt` | Hub: Thêm / Danh sách / Báo cáo |

**Storage hiện tại:** `images/{uid}/{safeIncidentId}/{before|after}/{file}`

**Sync:** `incidentFromFirestoreDoc` **không đọc** field lạ → app cũ vẫn chạy; cần bổ sung mapping khi triển khai rework.

### 2.4 Deploy

- Build: `website/build-dieu-hanh.bat` → `website/dashboard/`, `website/dieu-hanh/`
- `license-admin` **tách biệt** — không đụng tới feature này

---

## 3. Thiết kế dữ liệu (chỉ bổ sung)

### 3.1 Object `rework` (trạng thái hiện tại)

Theo yêu cầu nghiệp vụ, lưu **trên cùng document incident**:

```json
{
  "rework": {
    "required": false,
    "status": "NONE",
    "reason": "",
    "note": "",
    "assignedAt": null,
    "assignedBy": "",
    "completedAt": null,
    "approvedAt": null,
    "submissionNote": "",
    "submissionImages": []
  }
}
```

| Field | Mô tả |
|-------|--------|
| `required` | `true` khi Admin đã giao việc; `false` sau khi duyệt xong |
| `status` | `NONE` \| `ASSIGNED` \| `PENDING_APPROVAL` \| `APPROVED` |
| `reason` | Lý do chọn sẵn (dropdown Admin) |
| `note` | Ghi chú tự do Admin (textarea) — **bổ sung**, không thay field `note` sự cố |
| `assignedAt` | ISO hoặc `dd/MM/yyyy HH:mm` — thống nhất format khi code |
| `assignedBy` | Tên/email ADMIN |
| `completedAt` | User bấm "Gửi duyệt" |
| `approvedAt` | Admin bấm "Duyệt" |
| `submissionNote` | Ghi chú User khi bổ sung |
| `submissionImages` | URL ảnh bổ sung (Storage) — **tách** `beforeImages`/`afterImages` |

**Mặc định document cũ:** không có `rework` → coi như `{ required: false, status: "NONE" }`.

### 3.2 Mảng `reworkHistory` (lịch sử một vòng — bổ sung)

**Mỗi sự cố chỉ giao việc bổ sung tối đa một lần** (sau `APPROVED` không giao lại). `reworkHistory` lưu audit trail vòng đó, **không sửa `updates[]`**:

```json
{
  "reworkHistory": [
    {
      "type": "ASSIGNED",
      "at": "07/06/2026 14:30",
      "by": "Nguyễn Văn A (Admin)",
      "reason": "Ảnh sau xử lý chưa rõ",
      "note": "Cần chụp lại toàn cảnh"
    },
    {
      "type": "SUBMITTED",
      "at": "08/06/2026 09:15",
      "by": "Trần Văn B",
      "submissionNote": "Đã chụp lại 3 góc",
      "submissionImages": ["https://..."]
    },
    {
      "type": "APPROVED",
      "at": "08/06/2026 16:00",
      "by": "Nguyễn Văn A (Admin)"
    }
  ]
}
```

- Mỗi lần Admin **Giao việc** → push `ASSIGNED`
- User **Gửi duyệt** → push `SUBMITTED`
- Admin **Duyệt** → push `APPROVED`, `required = false`, **merge ảnh bổ sung vào `afterImages`**

**Lý do tách `reworkHistory`:** Không đụng schema `updates[]` (date, progress, note, images, createdBy) đang dùng cho tiến độ thi công.

### 3.3 Format ngày tháng (thống nhất app + web)

| Ngữ cảnh | Format | Nguồn tham chiếu |
|----------|--------|------------------|
| Lưu Firestore `rework.*At`, `reworkHistory[].at` | **`dd/MM/yyyy`** | App: `IncidentDispatch.todayDisplay()` |
| Hiển thị Web | **`dd/MM/yyyy`** | Web: `todayViDateString()`, `formatDate()`, `parseViDate()` |
| `updatedAt` document | `serverTimestamp()` | Giữ như hiện tại |

**Không dùng** ISO `yyyy-MM-dd` cho field rework (trừ khi parse ngược từ dữ liệu cũ). Helper web: tái dùng `todayViDateString()`; Android: `IncidentDispatch.todayDisplay()`.

### 3.4 Ảnh bổ sung — Storage & merge sau duyệt

| Giai đoạn | Hành vi |
|-----------|---------|
| User upload (chờ duyệt) | Upload tạm `images/{uid}/{id}/rework/{timestamp}_{file}` → URL ghi vào `rework.submissionImages` |
| Admin duyệt | **`arrayUnion` từng URL vào `afterImages`** (ảnh sau thi công chính thức) |
| App pull sau duyệt | `FirebaseSync` merge `afterImages` → `afterPhotos` local (logic `mergePhotoPaths` hiện có) |
| Báo cáo / gallery | Ảnh đã duyệt hiện ở **Sau thi công** như ảnh after thông thường |

| Loại | Path Storage |
|------|----------------|
| Trước thi công | `images/{uid}/{id}/before/...` (không đổi) |
| Sau thi công | `images/{uid}/{id}/after/...` (không đổi) |
| Tạm khi chờ duyệt | `images/{uid}/{id}/rework/...` (path mới) |

- `storage.rules` — **không sửa** (prefix `images/` đã cho phép).
- **Không** ghi vào `afterImages` khi User mới gửi duyệt — chỉ khi Admin **Duyệt**.

### 3.5 Firestore Rules & Index

| Hạng mục | Cần sửa? | Ghi chú |
|----------|----------|---------|
| `firestore.rules` | **Không** (dự kiến) | `rework` không nằm core-lock list |
| `firestore.indexes.json` | **Không** (giai đoạn 1) | Lọc tab Admin trên dữ liệu đã subscribe (client-side) |
| Index tương lai | Tùy chọn | Nếu > ~500 sự cố/công ty: `companyId` + `rework.status` |

---

## 4. Luồng trạng thái

```
NONE ──(Admin: Giao việc)──► ASSIGNED
                                  │
                    (User: Gửi duyệt)
                                  ▼
                          PENDING_APPROVAL
                                  │
                      (Admin: Duyệt)
                                  ▼
                    APPROVED + required=false
                              │
                              └── (kết thúc — không giao lại)
```

**Sau `APPROVED`:** ẩn vĩnh viễn nút **Yêu cầu bổ sung** trên sự cố đó.

| Tab Web Admin | Điều kiện lọc |
|---------------|----------------|
| Chưa thực hiện | `rework.required==true` && `status==ASSIGNED` |
| Chờ duyệt | `rework.required==true` && `status==PENDING_APPROVAL` |
| Hoàn thành | `rework.status==APPROVED` (hoặc có bản ghi `APPROVED` trong `reworkHistory`) |

**Màn User Android:** `rework.required==true` && `status != APPROVED`

---

## 5. Màn hình & file cần bổ sung

### 5.1 Web Admin (`dieu-hanh-web`)

#### A. Popup chi tiết sự cố (`IncidentDetailDrawer.tsx`)

| Bổ sung | Mô tả |
|---------|--------|
| Nút **🔄 Yêu cầu bổ sung** | Chỉ ADMIN; ẩn khi `ASSIGNED` / `PENDING_APPROVAL` / **`APPROVED`** (không giao lại) |
| Dialog con | Dropdown lý do + textarea ghi chú + nút **Giao việc** |
| Badge trạng thái rework | Hiển thị nếu `rework.required` |
| Gallery ảnh bổ sung | Section riêng `submissionImages` (nếu có) |
| Timeline mở rộng | Gộp `updates[]` + `reworkHistory[]` theo thời gian (component mới hoặc mở rộng `IncidentTimeline`) |

**Service mới (gợi ý):** `src/services/reworkService.ts`
- `assignRework(ownerUid, docId, { reason, note, assignedBy })`
- `approveRework(ownerUid, docId, { approvedBy })`

#### B. Menu **Yêu cầu bổ sung** (route mới)

| File mới | Mô tả |
|----------|--------|
| `src/pages/dispatch/DispatchReworkPage.tsx` | 3 tab + danh sách |
| `src/components/dispatch/ReworkIncidentCard.tsx` | Card / hàng tóm tắt |
| `src/components/dispatch/ReworkApprovalDialog.tsx` | Xem ảnh cũ + mới + duyệt |

**Routing (`App.tsx`):**
```
/rework → DispatchReworkPage
```

**Nav (`AppLayout.tsx`):** thêm mục "Yêu cầu bổ sung" (icon `RefreshCw` hoặc `ClipboardList`).

#### C. Type & map

| File | Thay đổi |
|------|----------|
| `src/types/incident.ts` | `IncidentRework`, `ReworkHistoryEntry`, `rework?`, `reworkHistory?` |
| `src/services/incidentsService.ts` | `mapDoc` đọc `rework`, `reworkHistory` |

**Không sửa:** `applyDispatchFilters`, `computeDispatchSummary`, export Excel/Word, `priorityColor`, logic tiến độ.

---

### 5.2 App Kotlin (USER)

#### A. Model & DB local

| Bổ sung | Chi tiết |
|---------|----------|
| `ReworkState` (data class) | Mirror field Firestore |
| SQLite | **Cách A (khuyến nghị):** cột JSON/text `reworkJson` trên `incidents` qua `ensureColumn()` DB v12 |
| | **Cách B:** bảng `incident_rework` riêng — ít đụng row chính hơn |

**Không đổi** cột / logic hiện có của `Incident`.

#### B. Sync (`FirebaseSync.kt` hoặc `ReworkSync.kt` mới)

| Hàm | Hành vi |
|-----|---------|
| Pull | Đọc `rework` + `reworkHistory` từ Firestore → lưu local |
| User submit | `updateDoc` **chỉ** field `rework` + `arrayUnion` `reworkHistory` — **không** gọi `uploadIncident` full |
| Upload ảnh rework | Path `rework/` — **không** dùng `uploadImages(type=before/after)` |

**Quan trọng:** `uploadIncident` / `appendDispatchMeta` **không được** gửi `rework: null` hoặc object rỗng làm mất dữ liệu Admin. Chỉ merge field khi User submit rework.

#### C. UI mới

| Màn hình | File gợi ý |
|----------|-------------|
| **📋 Việc cần xử lý** | `ReworkTaskListActivity.kt` |
| Chi tiết / thực hiện | `ReworkExecuteActivity.kt` |
| Entry từ `MainActivity` | Nút mới — **không** đổi luồng Thêm/Danh sách/Báo cáo |

**ReworkExecuteActivity:**
- Hiển thị: tuyến, lý trình, loại, lý do, ngày giao
- Chụp / chọn ảnh (tái sử dụng pattern compress từ `AddIncidentActivity` — **copy logic**, không sửa `AddIncidentActivity`)
- Textarea ghi chú
- **Khóa** field tuyến, km, loại, khối lượng (read-only)
- Nút **Gửi duyệt**

#### D. `AndroidManifest.xml`

Đăng ký 2 Activity mới.

---

## 6. API / hành động cụ thể (Firestore)

### 6.1 Admin — Giao việc

```javascript
// updateDoc(users/{ownerUid}/incidents/{id})
{
  rework: {
    required: true,
    status: "ASSIGNED",
    reason: "...",
    note: "...",
    assignedAt: "dd/MM/yyyy",  // IncidentDispatch.todayDisplay() / todayViDateString()
    assignedBy: "...",
    completedAt: null,
    approvedAt: null,
    submissionNote: "",
    submissionImages: []
  },
  reworkHistory: arrayUnion({
    type: "ASSIGNED",
    at: "...",
    by: "...",
    reason: "...",
    note: "..."
  }),
  updatedAt: serverTimestamp()
}
```

### 6.2 User — Gửi duyệt

```javascript
{
  "rework.status": "PENDING_APPROVAL",
  "rework.completedAt": "...",
  "rework.submissionNote": "...",
  "rework.submissionImages": ["url1", "url2"],
  reworkHistory: arrayUnion({ type: "SUBMITTED", ... }),
  updatedAt: serverTimestamp()
}
```

### 6.3 Admin — Duyệt

```javascript
{
  afterImages: arrayUnion(...rework.submissionImages),  // ảnh vào sau thi công
  rework: {
    required: false,
    status: "APPROVED",
    approvedAt: "dd/MM/yyyy",
    // giữ reason/note/assigned*/submission* để đọc lịch sử
  },
  reworkHistory: arrayUnion({
    type: "APPROVED",
    at: "dd/MM/yyyy",
    by: "...",
    mergedImageCount: N
  }),
  updatedAt: serverTimestamp()
}
```

**Lưu ý Android:** Không gọi `uploadIncident` full — chỉ `updateDoc` field trên. Lần pull tiếp theo app merge `afterImages` vào `afterPhotos` như ảnh after thường.

---

## 7. Timeline trong popup chi tiết

**Thứ tự hiển thị gợi ý** (merge sort theo ngày):

1. Sự kiện từ `updates[]` (giữ nguyên — tiến độ thi công)
2. Sự kiện từ `reworkHistory[]` (giao việc / bổ sung / duyệt)

**Nhãn tiếng Việt:**

| type | Hiển thị |
|------|----------|
| `ASSIGNED` | Admin yêu cầu bổ sung |
| `SUBMITTED` | User bổ sung ảnh |
| `APPROVED` | Admin duyệt |

Ví dụ đúng yêu cầu user đã nêu trong spec.

---

## 8. Rủi ro & biện pháp

| # | Rủi ro | Mức | Biện pháp |
|---|--------|-----|-----------|
| 1 | App cũ ghi đè `rework` khi sync full incident | **Cao** | User submit rework dùng `updateDoc` riêng; `uploadIncident` **không** đưa key `rework` vào payload; review `appendDispatchMeta` |
| 2 | Ảnh rework lẫn ảnh báo cáo | **Cao** | Path Storage `rework/`; không `arrayUnion` vào `beforeImages`/`afterImages` |
| 3 | Nhầm `note` sự cố vs `rework.note` | Trung bình | Đặt tên rõ trong UI: "Ghi chú yêu cầu bổ sung" |
| 4 | Document cũ thiếu `rework` → crash | Thấp | Optional chaining; default `NONE` ở map |
| 5 | Tab Admin chậm khi lọc client | Thấp | Giai đoạn 1 OK; sau thêm index nếu cần |
| 6 | User sửa core field qua rework screen | Trung bình | UI read-only; không mở `AddIncidentActivity` edit mode |
| 7 | `reworkHistory` phình to | Thấp | Chỉ append; hiển thị 20 mục gần nhất nếu cần |
| 8 | Excel/Word thiếu ảnh sau duyệt | Thấp | Sau duyệt ảnh nằm trong `afterImages` → export/ghép ảnh **tự nhận** như after hiện có |
| 9 | Web Admin cũ trên Vercel | Thấp | Deploy `build-dieu-hanh.bat`; field mới backward-compatible |
| 10 | Firestore rules chặn User update `rework` | Thấp | Owner được `update` incident; `rework` không thuộc core lock |

---

## 9. Thứ tự triển khai đề xuất

### Phase 1 — Nền tảng dữ liệu (1–2 ngày)
- [ ] Type TS + `mapDoc` + helper parse default `rework`
- [ ] `reworkService.ts` (assign, approve)
- [ ] Unit test nhỏ: parse document không có `rework`

### Phase 2 — Web Admin (2–3 ngày)
- [ ] Nút + form trong `IncidentDetailDrawer`
- [ ] Trang `/rework` 3 tab
- [ ] Dialog duyệt (ảnh cũ / ảnh bổ sung)
- [ ] Timeline mở rộng
- [ ] Build + deploy `website/dashboard`

### Phase 3 — Android (3–4 ngày)
- [ ] DB migration v12 + model
- [ ] `ReworkSync.kt` (pull + submit + upload ảnh)
- [ ] `ReworkTaskListActivity` + `ReworkExecuteActivity`
- [ ] Nút MainActivity
- [ ] Test offline → online

### Phase 4 — Kiểm thử tích hợp (1 ngày)
- [ ] Admin giao → User thấy realtime (web đã có `onSnapshot`)
- [ ] User gửi → Admin tab "Chờ duyệt"
- [ ] Admin duyệt → biến mất khỏi list User
- [ ] App cũ (không update) vẫn dùng được — không crash
- [ ] Ảnh đã duyệt xuất hiện trong gallery/báo cáo **Sau thi công** (không sửa code export)

---

## 10. Danh sách file dự kiến (chưa tạo)

### Web (`dieu-hanh-web`)
```
src/types/incident.ts                    [sửa — thêm type]
src/types/rework.ts                      [mới — optional tách file]
src/lib/reworkUtils.ts                   [mới — parse, filter tab]
src/services/reworkService.ts            [mới]
src/services/incidentsService.ts         [sửa — mapDoc]
src/components/dispatch/IncidentDetailDrawer.tsx  [sửa]
src/components/dispatch/ReworkAssignDialog.tsx    [mới]
src/components/dispatch/ReworkApprovalDialog.tsx  [mới]
src/components/dispatch/IncidentTimeline.tsx      [sửa hoặc ReworkTimeline.tsx]
src/pages/dispatch/DispatchReworkPage.tsx         [mới]
src/App.tsx                              [sửa — route]
src/components/layout/AppLayout.tsx      [sửa — nav]
```

### Android (`app`)
```
incident/model/ReworkState.kt            [mới]
incident/data/DatabaseHelper.kt          [sửa — v12]
com/tuanduong/sync/ReworkSync.kt         [mới]
com/tuanduong/app/ReworkTaskListActivity.kt   [mới]
com/tuanduong/app/ReworkExecuteActivity.kt    [mới]
res/layout/activity_rework_*.xml         [mới]
AndroidManifest.xml                      [sửa]
MainActivity.kt + layout                 [sửa — nút mới]
```

### Không sửa (trừ khi bug blocker)
- `firestore.rules`, `storage.rules`, collection path
- `AddIncidentActivity` logic lưu sự cố
- `excelReportBuilder.ts`, `incidentExportService.ts`
- `IncidentDispatch.kt` progress / `updates[]`
- `license-admin/`

---

## 11. Tiêu chí hoàn thành (Acceptance)

- [ ] Admin giao việc từ popup chi tiết — không đổi tiến độ / khối lượng / km
- [ ] User chỉ bổ sung ảnh + ghi chú — không sửa core field
- [ ] Tab Web: 3 trạng thái lọc đúng
- [ ] Admin duyệt → `required=false`, `status=APPROVED`, ảnh vào `afterImages`
- [ ] Sau duyệt **không** giao lại cùng sự cố
- [ ] Timeline đủ 4 loại sự kiện (tạo, hoàn thành, giao việc, bổ sung, duyệt)
- [ ] Dữ liệu cũ không `rework` vẫn hiển thị bình thường
- [ ] App Kotlin cũ (chưa update) không mất dữ liệu Firestore

---

## 12. Quyết định đã xác nhận (stakeholder)

| # | Câu hỏi | Quyết định |
|---|---------|------------|
| 1 | Format ngày | **`dd/MM/yyyy`** — thống nhất app (`IncidentDispatch.todayDisplay()`) và web (`todayViDateString()` / `parseViDate`) |
| 2 | Giao lại sau duyệt? | **Không** — mỗi sự cố tối đa một vòng rework; sau `APPROVED` ẩn nút giao việc |
| 3 | Ảnh bổ sung sau duyệt | **Có** — `arrayUnion` vào **`afterImages`** (ảnh sau thi công); báo cáo/gallery dùng luồng after hiện có |
| 4 | Push notification (FCM) | **Chưa cần** v1 — User tự mở màn **Việc cần xử lý** |

---

**Kết luận:** Feature triển khai theo hướng **chỉ bổ sung field + màn hình mới**, tuân thủ `docs/MIGRATION_INCIDENT_DISPATCH.md`. Bắt đầu **Phase 1** (type + service + map Firestore) khi được yêu cầu implement.
