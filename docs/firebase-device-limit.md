# Giới hạn thiết bị đăng nhập (Firebase)

## Cấu trúc Firestore `users/{uid}`

| Trường | Kiểu | Ai ghi | Mô tả |
|--------|------|--------|--------|
| `active` | boolean | Admin Console | Bật license |
| `expireDate` | string | Admin | `"yyyy-MM-dd"` |
| `name` | string | Admin | Tên hiển thị |
| **`maxDevices`** | number | **Admin** | Số thiết bị tối đa (vd. `3`). Mặc định app: `3` nếu thiếu |
| `activeDevices` | map | App khi login | Key = `deviceId`, value = object bên dưới |
| `sessionId` | string | App (legacy) | Vẫn ghi để tương thích; ưu tiên kiểm tra theo `activeDevices` |

Mỗi phần tử trong `activeDevices`:

```json
{
  "sessionId": "1779402041101",
  "deviceName": "Samsung SM-G991B",
  "platform": "android",
  "lastLoginAt": "<server timestamp>"
}
```

### Chỉnh trên Firebase Console

Với user hiện có (ảnh mẫu: `active`, `expireDate`, `name`, `sessionId`):

1. Thêm **một field**: `maxDevices` = `3` — kiểu **number**, không phải string `"3"`.
2. **Không** cần tạo tay `activeDevices` — app tự ghi khi user đăng nhập lần đầu sau cập nhật.
3. Có thể xóa `sessionId` cũ sau khi mọi máy đã login lại (tuỳ chọn).

---

## Luồng đăng nhập

1. Firebase Auth `signInWithEmailAndPassword`.
2. Transaction Firestore:
   - Đọc `maxDevices`, `activeDevices`.
   - Nếu `deviceId` đã có → cập nhật session (cho phép).
   - Nếu chưa có và `size < maxDevices` → thêm thiết bị.
   - Nếu đầy → **chặn**, trả danh sách thiết bị để user chọn đá một máy.
3. User chọn thiết bị cũ → transaction xóa key đó và thêm máy hiện tại.

Đăng xuất: xóa `activeDevices.{deviceId}`.

Listener trên `users/{uid}`: so `activeDevices[deviceId].sessionId` với session local → khác thì kick.

---

## React (Auth + Firestore) — tham khảo

```javascript
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";

const DEFAULT_MAX = 3;
const deviceIdKey = "app_device_id";

function getDeviceId() {
  let id = localStorage.getItem(deviceIdKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(deviceIdKey, id);
  }
  return id;
}

function deviceEntry(sessionId, deviceName) {
  return {
    sessionId,
    deviceName: deviceName || "Web",
    platform: "web",
    lastLoginAt: serverTimestamp(),
  };
}

export async function loginWithDeviceLimit(email, password) {
  const auth = getAuth();
  const db = getFirestore();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const deviceId = getDeviceId();
  const sessionId = String(Date.now());
  const userRef = doc(db, "users", uid);

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const maxDevices = snap.data()?.maxDevices ?? DEFAULT_MAX;
    const devices = { ...(snap.data()?.activeDevices || {}) };

    if (devices[deviceId]) {
      devices[deviceId] = deviceEntry(sessionId, navigator.userAgent);
    } else if (Object.keys(devices).length < maxDevices) {
      devices[deviceId] = deviceEntry(sessionId, navigator.userAgent);
    } else {
      return {
        ok: false,
        maxDevices,
        blockedDevices: Object.entries(devices).map(([id, d]) => ({
          deviceId: id,
          ...d,
        })),
      };
    }

    tx.set(userRef, { activeDevices: devices, sessionId }, { merge: true });
    return { ok: true, sessionId };
  });

  if (!result.ok) {
    return { status: "limit", ...result };
  }

  localStorage.setItem("app_session_id", result.sessionId);
  return { status: "ok", uid };
}

export async function replaceDeviceAndLogin(uid, deviceIdToRemove) {
  const db = getFirestore();
  const deviceId = getDeviceId();
  const sessionId = String(Date.now());
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const devices = { ...(snap.data()?.activeDevices || {}) };
    delete devices[deviceIdToRemove];
    devices[deviceId] = deviceEntry(sessionId, navigator.userAgent);
    tx.set(userRef, { activeDevices: devices, sessionId }, { merge: true });
  });

  localStorage.setItem("app_session_id", sessionId);
}

export function isSessionValid(activeDevices, legacySessionId) {
  const local = localStorage.getItem("app_session_id");
  const deviceId = getDeviceId();
  if (!local) return false;

  if (activeDevices && Object.keys(activeDevices).length > 0) {
    return activeDevices[deviceId]?.sessionId === local;
  }
  return legacySessionId === local;
}

export async function logoutDevice(uid) {
  const db = getFirestore();
  const deviceId = getDeviceId();
  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const devices = { ...(snap.data()?.activeDevices || {}) };
    delete devices[deviceId];
    tx.update(userRef, { activeDevices: devices });
  });
  await signOut(getAuth());
}
```

---

## Android (app hiện tại)

Logic tương đương: `DeviceSessionManager.kt`, gọi từ `LoginActivity`, listener + logout trong `MainActivity`.

Deploy rules: `firestore.rules` cho phép user sửa `sessionId` và `activeDevices`.
