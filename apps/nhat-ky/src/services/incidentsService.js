import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { clampProgress, statusFromProgress } from "../utils/incidentUtils";

function mapDoc(snap) {
  const data = snap.data();
  if (data.deleted === 1) return null;
  return mapCore(snap.id, data);
}

function mapCore(id, data) {
  return {
    id,
    road: data.road ?? "",
    groupName: data.groupName ?? "",
    type: data.type ?? "",
    date: data.date ?? "",
    completedDate: data.completedDate ?? "",
    km: data.km ?? "",
    position: data.position ?? "",
    dai: data.dai ?? 0,
    rong: data.rong ?? 0,
    cao: data.cao ?? 0,
    unit: data.unit ?? "",
    note: data.note ?? "",
    beforeImages: data.beforeImages ?? [],
    afterImages: data.afterImages ?? [],
    selectedBefore: data.selectedBefore ?? "",
    selectedAfter: data.selectedAfter ?? "",
    status: data.status,
    progress: data.progress ?? 0,
    updates: data.updates ?? [],
    pipeType: data.pipeType ?? "",
    soilPercent: typeof data.soilPercent === "number" ? data.soilPercent : -1,
    geologyType: data.geologyType ?? "",
    createdByName: data.createdByName ?? "",
    companyId: data.companyId ?? "",
    deletedAtMs: data.deletedAt?.toMillis ? data.deletedAt.toMillis() : 0
  };
}

/** Chỉ đọc sự cố của chính user đăng nhập — không query công ty / user khác. */
export async function fetchMyIncidents(uid) {
  const snap = await getDocs(collection(db, "users", uid, "incidents"));
  return snap.docs.map(mapDoc).filter(Boolean);
}

/** Lắng nghe realtime — app thêm/sửa sự cố sẽ hiện ngay trên web. */
export function subscribeMyIncidents(uid, onData, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, "users", uid, "incidents"),
    (snap) => {
      onData(snap.docs.map(mapDoc).filter(Boolean));
    },
    (err) => onError?.(err)
  );
}

/** Lắng nghe thùng rác (deleted === 1), mới xoá lên trước. */
export function subscribeTrashIncidents(uid, onData, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, "users", uid, "incidents"),
    (snap) => {
      const list = snap.docs
        .filter((d) => d.data().deleted === 1)
        .map((d) => mapCore(d.id, d.data()))
        .sort((a, b) => b.deletedAtMs - a.deletedAtMs);
      onData(list);
    },
    (err) => onError?.(err)
  );
}

function todayVi() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Chuẩn hoá về dd/MM/yyyy (ViDateInput trả ISO yyyy-mm-dd). */
function normalizeViDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function resolveCompletedDate(progress, completedDate) {
  const c = normalizeViDate(completedDate);
  if (c) return c;
  if (clampProgress(progress) >= 90) return todayVi();
  return "";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tạo sự cố mới trong users/{uid}/incidents. Trả về id document. */
export async function createIncident(uid, input) {
  const ref = doc(collection(db, "users", uid, "incidents"));
  const id = ref.id;
  const progress = clampProgress(input.progress);
  const status = statusFromProgress(progress);
  const completedDate = resolveCompletedDate(progress, input.completedDate);
  const note = String(input.note || "").trim();
  const date = normalizeViDate(input.date) || todayVi();

  await setDoc(ref, {
    incidentId: id,
    uuid: "",
    code: "",
    road: String(input.road || "").trim(),
    groupName: String(input.groupName || "").trim(),
    type: String(input.type || "").trim(),
    date,
    completedDate,
    km: String(input.km || "").trim(),
    position: String(input.position || "").trim(),
    dai: toNum(input.dai),
    rong: toNum(input.rong),
    cao: toNum(input.cao),
    unit: String(input.unit || "").trim() || "m3",
    pipeType: String(input.pipeType || "").trim(),
    geologyType: "",
    soilPercent:
      typeof input.soilPercent === "number" && input.soilPercent >= 0 && input.soilPercent <= 100
        ? input.soilPercent
        : -1,
    note,
    beforeImages: [],
    afterImages: [],
    selectedBefore: "",
    selectedAfter: "",
    status,
    progress,
    locked: false,
    deleted: 0,
    priority: "NORMAL",
    createdByName: String(input.createdByName || "").trim(),
    companyId: String(input.companyId || "").trim(),
    updates: [
      {
        date: new Date().toISOString().slice(0, 10),
        progress: 0,
        note: note || "Phát hiện sự cố",
        images: [],
        createdBy: String(input.createdByName || "").trim()
      }
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return id;
}

/** Cập nhật metadata sự cố (không đụng tới ảnh đã lưu). */
export async function updateIncident(uid, docId, patch) {
  const progress = clampProgress(patch.progress);
  const completedDate = resolveCompletedDate(progress, patch.completedDate);
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    road: String(patch.road || "").trim(),
    groupName: String(patch.groupName || "").trim(),
    type: String(patch.type || "").trim(),
    date: normalizeViDate(patch.date),
    completedDate,
    km: String(patch.km || "").trim(),
    position: String(patch.position || "").trim(),
    dai: toNum(patch.dai),
    rong: toNum(patch.rong),
    cao: toNum(patch.cao),
    unit: String(patch.unit || "").trim() || "m3",
    pipeType: String(patch.pipeType || "").trim(),
    note: String(patch.note || "").trim(),
    progress,
    status: statusFromProgress(progress),
    updatedAt: serverTimestamp()
  });
}

/** Chuyển vào thùng rác (giữ lại để khôi phục). */
export async function softDeleteIncident(uid, docId) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    deleted: 1,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** Khôi phục từ thùng rác. */
export async function restoreIncident(uid, docId) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    deleted: 0,
    deletedAt: deleteField(),
    updatedAt: serverTimestamp()
  });
}

/** Xoá vĩnh viễn (không khôi phục được). */
export async function permanentlyDeleteIncident(uid, docId) {
  await deleteDoc(doc(db, "users", uid, "incidents", docId));
}

/** Lưu danh sách ảnh đã chọn ghép Word (nhiều URL, phân tách bằng |). */
export async function updateSelectedReportPhoto(uid, docId, field, value) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    [field]: String(value ?? ""),
    updatedAt: serverTimestamp()
  });
}
