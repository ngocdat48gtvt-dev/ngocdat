import {
  inferEntryUnit,
  resolveEntryQuantity
} from "./incidentUtils";
import { formatBookDecimal } from "./bookNumberFormat";
import { BAO_LU_TICK_SECTIONS } from "./trafficDutyFormat";

function formatUnitPlain(unit) {
  const u = String(unit || "").trim().toLowerCase();
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m3" || u === "m³") return "m3";
  if (u === "m") return "m";
  return String(unit || "").trim();
}

/** Mét quy đổi từ lý trình (số thuần = km nguyên). */
function kmToMetersLocal(kmValue) {
  const raw = String(kmValue ?? "").trim();
  if (!raw) return NaN;
  let text = raw;
  while (/^km\s*/i.test(text)) {
    text = text.replace(/^km\s*/i, "").trim();
  }
  if (text.includes("+")) {
    const [a, b] = text.split("+", 2);
    const km = Number(String(a).replace(/\D/g, "")) || 0;
    const m = Number(String(b ?? "").replace(/\D/g, "").slice(0, 3)) || 0;
    return km * 1000 + m;
  }
  const n = Number(String(text).replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  if (n >= 1000) return Math.round(n);
  return Math.round(n * 1000);
}

function metersToKmInput(totalM) {
  if (!Number.isFinite(totalM) || totalM < 0) return "";
  const km = Math.floor(totalM / 1000);
  const m = Math.round(totalM % 1000);
  return `${km}+${String(m).padStart(3, "0")}`;
}

function entryTypeLabel(entry) {
  return String(entry?.type || entry?.sourceIncidentType || "").trim();
}

function stripMergeMeta(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const next = { ...entry };
  delete next.mergedSources;
  delete next.mergedSpotCount;
  return next;
}

/** Tách các nguồn gốc (kể cả gộp lồng nhau) thành danh sách dòng gốc. */
export function flattenMergedSources(entry) {
  if (!entry) return [];
  const nested = entry.mergedSources;
  if (Array.isArray(nested) && nested.length >= 2) {
    return nested.flatMap((s) => flattenMergedSources(s));
  }
  return [stripMergeMeta(entry)];
}

/** Khóa so khớp «cùng công việc» để gộp. */
export function diaryMergeKey(entry) {
  const unit = String(inferEntryUnit(entry) || entry?.unit || "")
    .trim()
    .toLowerCase();
  return [
    String(entry?.date || "").trim(),
    String(entry?.section || "").trim(),
    entryTypeLabel(entry).toLowerCase(),
    unit
  ].join("|");
}

export function validateDiaryMergeSelection(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length < 2) {
    return { ok: false, msg: "Chọn ít nhất 2 dòng để gộp." };
  }
  if (!entryTypeLabel(list[0])) {
    return { ok: false, msg: "Dòng thiếu tên sự cố — không gộp được." };
  }
  const key = diaryMergeKey(list[0]);
  if (!list.every((e) => diaryMergeKey(e) === key)) {
    return {
      ok: false,
      msg: "Chỉ gộp các dòng cùng ngày, cùng hạng mục, cùng tên sự cố và cùng đơn vị."
    };
  }
  return { ok: true };
}

/**
 * Gộp nhiều dòng cùng công việc thành 1 (chỉ trên sổ tuần đường).
 * Giữ mergedSources để sổ mặt đường / bão lũ / BDTX tách từng vị trí + «Bỏ gộp».
 */
export function mergeDiaryEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const check = validateDiaryMergeSelection(list);
  if (!check.ok) {
    const err = new Error(check.msg);
    err.code = "MERGE_INVALID";
    throw err;
  }

  const sources = list.flatMap(flattenMergedSources);
  const base = { ...sources[0] };
  let lo = Infinity;
  let hi = -Infinity;
  let qtySum = 0;

  sources.forEach((e) => {
    qtySum += resolveEntryQuantity(e) || 0;
    const fromM = kmToMetersLocal(e.kmFrom);
    let toM = kmToMetersLocal(e.kmTo);
    if (!Number.isFinite(fromM) || fromM < 0) return;
    if (!Number.isFinite(toM) || toM < 0) toM = fromM;
    lo = Math.min(lo, fromM, toM);
    hi = Math.max(hi, fromM, toM);
  });

  const unit = inferEntryUnit(base) || base.unit || "";
  const qtyRounded = Math.round(qtySum * 1000) / 1000;
  const section = String(base.section || "").trim();
  const anyBaoLu = sources.some(entryExportsBaoLu);

  return {
    ...base,
    kmFrom: Number.isFinite(lo) ? metersToKmInput(lo) : base.kmFrom,
    kmTo: Number.isFinite(hi) ? metersToKmInput(hi) : base.kmTo || base.kmFrom,
    side: "",
    length: "",
    width: "",
    height: "",
    quantity: qtyRounded > 0 ? String(qtyRounded) : base.quantity || "",
    unit,
    mergedSpotCount: sources.length,
    mergedSources: sources,
    content: "",
    locationNote: "",
    ...(BAO_LU_TICK_SECTIONS.has(section) ? { exportTrafficDuty: anyBaoLu } : {})
  };
}

/** Khôi phục các dòng gốc từ bản ghi đã gộp. */
export function unmergeDiaryEntries(entry) {
  if (!isMergedDiaryEntry(entry)) return null;
  const sources = flattenMergedSources(entry);
  return sources.length >= 2 ? sources : null;
}

/**
 * Mở rộng dòng đã gộp → từng vị trí gốc (sổ mặt đường, bão lũ, BDTX, thống kê KL…).
 */
export function expandEntriesForVolumeBooks(entries) {
  const out = [];
  for (const e of entries || []) {
    if (Array.isArray(e?.mergedSources) && e.mergedSources.length >= 2) {
      e.mergedSources.forEach((s) => {
        const stripped = stripMergeMeta(s);
        // Kế thừa cờ xuất / ngày BDTX từ bản gộp nếu nguồn chưa ghi.
        if (e.exportTrafficDuty === true && stripped.exportTrafficDuty !== false) {
          stripped.exportTrafficDuty = true;
        }
        if (e.exportMatDuong === true && stripped.exportMatDuong !== false) {
          stripped.exportMatDuong = true;
        }
        if (e.plannedRepairDate && !stripped.plannedRepairDate) {
          stripped.plannedRepairDate = e.plannedRepairDate;
        }
        out.push(stripped);
      });
    } else {
      out.push(e);
    }
  }
  return out;
}

/**
 * Cột 3 sổ tuần đường / cột chi tiết sổ mặt đường khi đã gộp:
 * «Ổ gà, khối lượng 2.5m2/ 2 vị trí, chi tiết sổ theo dõi mặt đường»
 * Nền đường có tick bão lũ: «…, chi tiết sổ theo dõi lũ bão»
 */
export function formatMergedDiaryContent(entry) {
  const n = Number(entry?.mergedSpotCount) || 0;
  if (n < 2) return "";
  const name = entryTypeLabel(entry) || "—";
  const unit = formatUnitPlain(inferEntryUnit(entry) || entry?.unit);
  const qtyStr = formatBookDecimal(resolveEntryQuantity(entry));
  let text = qtyStr
    ? `${name}, khối lượng ${qtyStr}${unit}/ ${n} vị trí`
    : `${name}/ ${n} vị trí`;
  const section = String(entry?.section || "").trim();
  if (section === "Mặt đường") {
    text += ", chi tiết sổ theo dõi mặt đường";
  } else if (
    entryExportsBaoLu(entry) ||
    (Array.isArray(entry?.mergedSources) &&
      entry.mergedSources.some(entryExportsBaoLu))
  ) {
    text += ", chi tiết sổ theo dõi lũ bão";
  }
  return text;
}

/** Dòng được tick / nguồn bão lũ → xuất sổ trực ĐBGT. */
function entryExportsBaoLu(entry) {
  const section = String(entry?.section || "").trim();
  if (!BAO_LU_TICK_SECTIONS.has(section)) return false;
  if (entry?.exportTrafficDuty === true) return true;
  if (entry?.exportTrafficDuty === false) return false;
  if (section !== "Nền đường") return false;
  const g = String(entry?.sourceGroupName || "").trim().toLowerCase();
  return g === "bão lũ" || g === "bao lu";
}

export function isMergedDiaryEntry(entry) {
  return (
    Number(entry?.mergedSpotCount) >= 2 ||
    (Array.isArray(entry?.mergedSources) && entry.mergedSources.length >= 2)
  );
}
