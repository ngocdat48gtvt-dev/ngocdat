import { fetchOfficeBookAsStorage } from "./officeBooksService";
import { fetchOfficeRoadsCatalog } from "./officeRoadsCatalogService";
import { downloadBlob } from "../utils/downloadBlob";
import { getRoadStorageKey, saveRoadsCatalog } from "../utils/roadsCatalog";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const OFFICE_BACKUP_FORMAT = "quan-ly-su-co-office-backup";
export const OFFICE_BACKUP_VERSION = 2;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Khôi phục hình dạng Timestamp mà bộ checksum v2 ban đầu đã nhìn thấy trước JSON.stringify. */
function legacyChecksumValue(value) {
  if (Array.isArray(value)) return value.map(legacyChecksumValue);
  if (!value || typeof value !== "object") return value;
  const result = {};
  Object.entries(value).forEach(([key, child]) => {
    if (key === "type" && String(child).startsWith("firestore/timestamp")) return;
    result[key] = legacyChecksumValue(child);
  });
  return result;
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error("Trình duyệt không hỗ trợ kiểm tra SHA-256.");
  const bytes = new TextEncoder().encode(stableJson(value));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeFilePart(value) {
  return String(value || "nguoi-dung").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "nguoi-dung";
}

function normalizedBackupText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Chỉ dọn dòng GPTC liên kết trùng; không suy đoán hoặc gộp dữ liệu người dùng nhập tay. */
function dedupeBackupDiaryEntries(entries) {
  const seenGptc = new Set();
  return (entries || []).filter((entry) => {
    if (entry?._deleted || entry?.deletedAt) return false;
    const permitId = String(entry?.sourceGptcPermitId || "").trim();
    const entryId = String(entry?.sourceGptcEntryId || "").trim();
    if (!permitId && !entryId) return true;
    const key = [
      permitId,
      String(entry?.date || "").trim(),
      normalizedBackupText(entry?.content),
      normalizedBackupText(entry?.leaderNote)
    ].join("|");
    if (seenGptc.has(key)) return false;
    seenGptc.add(key);
    return true;
  });
}

export async function createAndDownloadOfficeBackup({ uid, displayName, dateFrom = "", dateTo = "", onProgress }) {
  if (!uid) throw new Error("Không xác định được tài khoản cần sao lưu.");
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) throw new Error("Cần chọn đủ ngày bắt đầu và ngày kết thúc.");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");

  onProgress?.("Đang đọc danh sách sổ...");
  const catalog = await fetchOfficeRoadsCatalog(uid);
  const roads = [];
  for (let index = 0; index < catalog.roads.length; index += 1) {
    const road = catalog.roads[index];
    onProgress?.(`Đang sao lưu sổ ${index + 1}/${catalog.roads.length}: ${road.roadName || road.label || road.id}`);
    const storage = await fetchOfficeBookAsStorage(uid, road.id, { dateFrom, dateTo });
    const modulesSnap = await getDocs(collection(db, "users", uid, "office_books", road.id, "modules"));
    const modules = {};
    modulesSnap.docs.forEach((docSnap) => { modules[docSnap.id] = docSnap.data(); });
    roads.push({
      road,
      reportMeta: storage.reportMeta,
      metaRevision: storage.metaRevision,
      days: storage.remoteDays.map((day) => ({
        ...day,
        entries: dedupeBackupDiaryEntries(day.entries)
      })),
      modules
    });
  }

  const payload = jsonValue({
    createdAt: new Date().toISOString(),
    owner: { uid, displayName: displayName || "" },
    range: dateFrom ? { type: "range", dateFrom, dateTo } : { type: "all" },
    catalog,
    roads
  });
  onProgress?.("Đang tạo mã kiểm tra toàn vẹn...");
  const checksum = await sha256(payload);
  const backup = {
    format: OFFICE_BACKUP_FORMAT,
    schemaVersion: OFFICE_BACKUP_VERSION,
    checksumAlgorithm: "SHA-256",
    checksum,
    payload
  };
  const rangeName = dateFrom ? `${dateFrom}_den_${dateTo}` : "toan-bo";
  const filename = `NhatKy_${safeFilePart(displayName)}_${rangeName}_${new Date().toISOString().slice(0, 10)}.qldbackup`;
  await downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), filename);
  return { filename, roadCount: roads.length, dayCount: roads.reduce((sum, item) => sum + item.days.length, 0) };
}

export async function readOfficeBackup(file) {
  if (!file) throw new Error("Chưa chọn file backup.");
  if (file.size > 200 * 1024 * 1024) throw new Error("File backup vượt quá giới hạn 200 MB.");
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("File không đúng định dạng hoặc đã bị hỏng.");
  }
  if (parsed?.format !== OFFICE_BACKUP_FORMAT || !parsed.payload) {
    throw new Error("Đây không phải file backup Nhật ký được hỗ trợ.");
  }
  if (parsed.schemaVersion !== OFFICE_BACKUP_VERSION) {
    throw new Error("File backup cũ chưa chứa đầy đủ các đầu sổ. Hãy tạo một file backup mới.");
  }
  const actualChecksum = await sha256(parsed.payload);
  if (actualChecksum !== parsed.checksum) {
    const legacyChecksum = await sha256(legacyChecksumValue(parsed.payload));
    if (legacyChecksum !== parsed.checksum) {
      throw new Error("Dữ liệu không còn nguyên vẹn: mã kiểm tra không khớp.");
    }
  }
  return parsed.payload;
}

export function materializeOfficeBackup(payload) {
  const token = String(payload?.createdAt || Date.now()).replace(/[^0-9]/g, "").slice(-14);
  const nonce = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  const offlineUid = `backup_readonly_${token}_${nonce}`;
  const catalog = { ...(payload.catalog || {}), activeRoadId: payload.catalog?.activeRoadId || payload.roads?.[0]?.road?.id || "", roads: payload.roads?.map((item) => item.road) || [] };
  globalThis.__NHATKY_BACKUP_STORAGE__ = new Map();
  globalThis.__NHATKY_BACKUP_CATALOGS__ = new Map();
  saveRoadsCatalog(offlineUid, catalog);
  (payload.roads || []).forEach((item) => {
    const entries = [];
    const dayMeta = {};
    (item.days || []).forEach((day) => {
      entries.push(...dedupeBackupDiaryEntries(day.entries));
      if (day.dayMeta && Object.keys(day.dayMeta).length) dayMeta[day.date] = day.dayMeta;
    });
    globalThis.__NHATKY_BACKUP_STORAGE__.set(getRoadStorageKey(offlineUid, item.road.id), {
      entries,
      dayMeta,
      reportMeta: item.reportMeta || {},
      importMap: {}
    });
    const modules = item.modules || {};
    const gptc = modules.gptc?.ledger || modules.gptc;
    if (gptc && Object.keys(gptc).length) {
      localStorage.setItem(`gptc-v1-${offlineUid}__${item.road.id}`, JSON.stringify(gptc));
    }
    const demXe = modules.dem_xe || {};
    if (demXe.ledger) {
      localStorage.setItem(`dem-xe-v1-${offlineUid}__${item.road.id}`, JSON.stringify(demXe.ledger));
    }
    Object.entries(demXe.byRoute || {}).forEach(([routeId, ledger]) => {
      localStorage.setItem(`dem-xe-v1-${offlineUid}__${item.road.id}__${routeId}`, JSON.stringify(ledger));
    });
    const cau = modules.cau_inspections || {};
    Object.entries(cau.sheets || {}).forEach(([sheetId, sheet]) => {
      const separator = sheetId.lastIndexOf("__");
      if (separator <= 0) return;
      const bridgeId = sheetId.slice(0, separator);
      const yearMonth = sheetId.slice(separator + 2);
      localStorage.setItem(`cau-inspection-v2-${offlineUid}__${item.road.id}__${bridgeId}__${yearMonth}`, JSON.stringify(sheet));
    });
    if (cau.roadMeta) {
      localStorage.setItem(`cau-inspection-road-meta-v1-${offlineUid}__${item.road.id}`, JSON.stringify(cau.roadMeta));
    }
  });
  return { offlineUid, payload };
}

export function disposeOfficeBackup(session) {
  const uid = String(session?.offlineUid || "");
  if (!uid.startsWith("backup_readonly_")) return;
  globalThis.__NHATKY_BACKUP_CATALOGS__?.delete?.(uid);
  for (const key of Array.from(globalThis.__NHATKY_BACKUP_STORAGE__?.keys?.() || [])) {
    if (String(key).includes(uid)) globalThis.__NHATKY_BACKUP_STORAGE__.delete(key);
  }
  const remove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.includes(uid)) remove.push(key);
  }
  remove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Dọn phiên backup tạm còn sót từ bản cũ sau reload/crash.
 * Chỉ xóa key có UID synthetic backup_readonly_, không đụng dữ liệu USER thật.
 */
export function purgeStaleOfficeBackupStorage() {
  if (typeof localStorage === "undefined") return 0;
  const remove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.includes("backup_readonly_")) remove.push(key);
  }
  remove.forEach((key) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
  return remove.length;
}

function readLocalJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

async function buildEditedOfficeBackup(session) {
  if (!session?.offlineUid || !session?.payload) throw new Error("Không có phiên backup để lưu.");
  const { offlineUid } = session;
  const payload = jsonValue({
    ...session.payload,
    createdAt: new Date().toISOString(),
    editedOffline: true,
    roads: (session.payload.roads || []).map((item) => {
      const memory = globalThis.__NHATKY_BACKUP_STORAGE__?.get?.(getRoadStorageKey(offlineUid, item.road.id)) || {};
      const daysByDate = new Map((item.days || []).map((day) => [day.date, { ...day, entries: [] }]));
      (memory.entries || []).forEach((entry) => {
        const date = String(entry?.date || "").trim();
        if (!date) return;
        if (!daysByDate.has(date)) daysByDate.set(date, { date, entries: [], dayMeta: {} });
        daysByDate.get(date).entries.push(entry);
      });
      Object.entries(memory.dayMeta || {}).forEach(([date, dayMeta]) => {
        if (!daysByDate.has(date)) daysByDate.set(date, { date, entries: [], dayMeta });
        else daysByDate.get(date).dayMeta = dayMeta;
      });
      const modules = { ...(item.modules || {}) };
      const gptc = readLocalJson(`gptc-v1-${offlineUid}__${item.road.id}`);
      if (gptc) modules.gptc = { ...(modules.gptc || {}), ledger: gptc };
      const demXe = { ...(modules.dem_xe || {}) };
      const baseDemXe = readLocalJson(`dem-xe-v1-${offlineUid}__${item.road.id}`);
      if (baseDemXe) demXe.ledger = baseDemXe;
      (item.road.routes || []).forEach((route) => {
        const ledger = readLocalJson(`dem-xe-v1-${offlineUid}__${item.road.id}__${route.id}`);
        if (ledger) demXe.byRoute = { ...(demXe.byRoute || {}), [route.id]: ledger };
      });
      if (Object.keys(demXe).length) modules.dem_xe = demXe;
      const cauPrefix = `cau-inspection-v2-${offlineUid}__${item.road.id}__`;
      const cauSheets = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(cauPrefix)) continue;
        const sheetId = key.slice(cauPrefix.length);
        const sheet = readLocalJson(key);
        if (sheetId && sheet) cauSheets[sheetId] = sheet;
      }
      const cauMeta = readLocalJson(`cau-inspection-road-meta-v1-${offlineUid}__${item.road.id}`);
      if (Object.keys(cauSheets).length || cauMeta) {
        modules.cau_inspections = { ...(modules.cau_inspections || {}), sheets: cauSheets, roadMeta: cauMeta || {} };
      }
      return { ...item, reportMeta: memory.reportMeta || item.reportMeta, days: Array.from(daysByDate.values()).sort((a, b) => a.date.localeCompare(b.date)), modules };
    })
  });
  const checksum = await sha256(payload);
  const backup = { format: OFFICE_BACKUP_FORMAT, schemaVersion: OFFICE_BACKUP_VERSION, checksumAlgorithm: "SHA-256", checksum, payload };
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

export async function downloadEditedOfficeBackup(session) {
  const blob = await buildEditedOfficeBackup(session);
  const filename = `NhatKy_da-chinh-sua_${new Date().toISOString().replace(/[:.]/g, "-")}.qldbackup`;
  await downloadBlob(blob, filename);
  return filename;
}

export async function overwriteEditedOfficeBackup(session) {
  const handle = session?.fileHandle;
  if (!handle?.createWritable) throw new Error("Trình duyệt chưa cấp quyền ghi vào file backup cũ.");
  const blob = await buildEditedOfficeBackup(session);
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    try { await writable.abort?.(); } catch { /* ignore */ }
    throw err;
  }
  return handle.name || "file backup cũ";
}
