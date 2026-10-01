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
    reportImageOrder: data.reportImageOrder ?? "",
    /** Tick cột «Ghép ảnh Word» — nhớ trên cloud để máy khác thấy. */
    wordMergeChecked: Boolean(data.wordMergeChecked),
    /** 0 = chưa trình; ≥1 = lần trình hồ sơ (đồng bộ web điều hành). */
    dossierRound: (() => {
      const n = Number(data.dossierRound);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    })(),
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
    reportImageOrder: "",
    wordMergeChecked: false,
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

/**
 * Drawer chi tiết: cập nhật tiến độ và/hoặc ngày hoàn thành.
 * Có ngày hoàn thành → tiến độ = 100% (DONE).
 */
export async function updateIncidentProgressFields(
  uid,
  docId,
  { progress, completedDate } = {}
) {
  const patch = { updatedAt: serverTimestamp() };

  if (completedDate !== undefined) {
    const dateVi = normalizeViDate(completedDate);
    if (dateVi) {
      patch.completedDate = dateVi;
      patch.progress = 100;
      patch.status = statusFromProgress(100);
    } else {
      patch.completedDate = "";
    }
  }

  if (progress !== undefined && patch.progress === undefined) {
    const p = clampProgress(progress);
    patch.progress = p;
    patch.status = statusFromProgress(p);
  }

  await updateDoc(doc(db, "users", uid, "incidents", docId), patch);
  return {
    progress: patch.progress,
    status: patch.status,
    completedDate: patch.completedDate
  };
}

/** @deprecated dùng updateIncidentProgressFields */
export async function updateIncidentCompletedDate(uid, docId, completedDate, progress = 0) {
  const value = resolveCompletedDate(progress, completedDate);
  const result = await updateIncidentProgressFields(uid, docId, {
    completedDate: value || completedDate || ""
  });
  return result.completedDate ?? value;
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

/** Lưu thứ tự ảnh ghép báo cáo Word (+ đồng bộ selectedBefore/selectedAfter). */
export async function updateReportImageSelection(
  uid,
  docId,
  reportImageOrder,
  selectedBefore,
  selectedAfter
) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    reportImageOrder: String(reportImageOrder ?? ""),
    selectedBefore: String(selectedBefore ?? ""),
    selectedAfter: String(selectedAfter ?? ""),
    updatedAt: serverTimestamp()
  });
}

/** Gán lần trình hồ sơ (0 = chưa trình) cho các sự cố của user. */
export async function setMyIncidentsDossierRoundBulk(uid, ids, dossierRound) {
  const round =
    Number.isFinite(dossierRound) && dossierRound > 0 ? Math.floor(dossierRound) : 0;
  let ok = 0;
  let fail = 0;
  for (const id of ids || []) {
    try {
      await updateDoc(doc(db, "users", uid, "incidents", id), {
        dossierRound: round,
        updatedAt: serverTimestamp()
      });
      ok++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

/**
 * Sửa hàng loạt ngày xảy ra / ngày hoàn thành.
 * - date: bắt buộc có giá trị nếu truyền (dd/MM/yyyy hoặc yyyy-mm-dd).
 * - completedDate: có giá trị → tiến độ 100%; chuỗi rỗng → chỉ xóa ngày HT (giữ tiến độ).
 */
export async function setMyIncidentsDatesBulk(uid, ids, { date, completedDate } = {}) {
  const hasDate = date !== undefined;
  const hasCompleted = completedDate !== undefined;
  if (!hasDate && !hasCompleted) return { ok: 0, fail: 0 };

  const dateVi = hasDate ? normalizeViDate(date) : undefined;
  const completedVi = hasCompleted ? normalizeViDate(completedDate) : undefined;
  if (hasDate && !dateVi) return { ok: 0, fail: (ids || []).length };

  let ok = 0;
  let fail = 0;
  for (const id of ids || []) {
    try {
      const patch = { updatedAt: serverTimestamp() };
      if (hasDate) patch.date = dateVi;
      if (hasCompleted) {
        if (completedVi) {
          patch.completedDate = completedVi;
          patch.progress = 100;
          patch.status = statusFromProgress(100);
        } else {
          patch.completedDate = "";
        }
      }
      await updateDoc(doc(db, "users", uid, "incidents", id), patch);
      ok++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

/** Tick / bỏ tick cột Ghép ảnh Word — lưu ngay lên Firestore. */
export async function updateWordMergeChecked(uid, docId, checked) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    wordMergeChecked: Boolean(checked),
    updatedAt: serverTimestamp()
  });
}

/** Tick hàng loạt cột Ghép ảnh Word. */
export async function updateWordMergeCheckedMany(uid, ids, checked) {
  const value = Boolean(checked);
  await Promise.all(
    (ids || []).map((id) =>
      updateDoc(doc(db, "users", uid, "incidents", id), {
        wordMergeChecked: value,
        updatedAt: serverTimestamp()
      })
    )
  );
}

/** @deprecated dùng updateReportImageSelection */
export async function updateSelectedReportPhoto(uid, docId, field, value) {
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    [field]: String(value ?? ""),
    updatedAt: serverTimestamp()
  });
}
