import { normalizeKmInput, formatDisplayDate, migrateEntry } from "./nhatKyFormat";
import {
  formatNhatKyResolvedCol,
  formatWorkName,
  formatUnitLabel
} from "./baoDuongFormat";
import { formatBookDecimal } from "./bookNumberFormat";
import { getMaintenanceNameForType, normalizeUnitValue } from "./baoDuongQualityStore";
import { CONG_GROUP_HU_HONG, formatCongTypeLabel } from "./congRegistryStore";

/** Trạng thái vận hành hiển thị trên danh sách cống. */
export const CONG_OP_STATUS = {
  BINH_THUONG: "binh_thuong",
  HU_HONG: "hu_hong",
  DA_XU_LY: "da_xu_ly",
  BO_SUNG: "bo_sung"
};

export const CONG_OP_STATUS_LABEL = {
  [CONG_OP_STATUS.BINH_THUONG]: "Bình thường",
  [CONG_OP_STATUS.HU_HONG]: "Hư hỏng",
  [CONG_OP_STATUS.DA_XU_LY]: "Đã xử lý",
  [CONG_OP_STATUS.BO_SUNG]: "Bổ sung mới"
};

/** Giá trị cột «Xuất sang DS cống» trên form nhập ("" = không xuất). */
export const CONG_EXPORT_STATUS = {
  NONE: "",
  HU_HONG: "hu_hong",
  SUA_CHUA: "sua_chua",
  BO_SUNG: "bo_sung"
};

export const CONG_EXPORT_STATUS_OPTIONS = [
  { value: CONG_EXPORT_STATUS.NONE, label: "— Không xuất" },
  { value: CONG_EXPORT_STATUS.HU_HONG, label: "Hư hỏng" },
  { value: CONG_EXPORT_STATUS.SUA_CHUA, label: "Sửa chữa" },
  { value: CONG_EXPORT_STATUS.BO_SUNG, label: "Bổ sung" }
];

const CONG_SECTION = "Cống, rãnh thoát nước";

function str(v) {
  return String(v ?? "").trim();
}

function isCongSection(entry) {
  const s = str(entry?.section);
  if (s === CONG_SECTION) return true;
  // Một số bản ghi cũ / alias
  return /cống.*rãnh|rãnh.*thoát\s*nước/i.test(s);
}

/** Chuẩn hoá giá trị xuất DS cống từ form / dữ liệu cũ. */
export function normalizeExportCongStatus(value, legacyExportCongList) {
  const s = str(value).toLowerCase().replace(/\s+/g, "_");
  if (
    s === CONG_EXPORT_STATUS.HU_HONG ||
    s === CONG_EXPORT_STATUS.SUA_CHUA ||
    s === CONG_EXPORT_STATUS.BO_SUNG
  ) {
    return s;
  }
  if (/hư\s*hỏng|hu\s*hong/.test(s)) return CONG_EXPORT_STATUS.HU_HONG;
  if (/sửa\s*chữa|sua\s*chua|đã\s*xử\s*lý|da\s*xu\s*ly/.test(s)) {
    return CONG_EXPORT_STATUS.SUA_CHUA;
  }
  if (/bổ\s*sung|bo\s*sung/.test(s)) return CONG_EXPORT_STATUS.BO_SUNG;
  // Legacy checkbox: tick = coi như xuất «Hư hỏng».
  if (legacyExportCongList === true || value === true) {
    return CONG_EXPORT_STATUS.HU_HONG;
  }
  return CONG_EXPORT_STATUS.NONE;
}

export function exportCongStatusLabel(status) {
  const hit = CONG_EXPORT_STATUS_OPTIONS.find((o) => o.value === status);
  return hit?.label || "— Không xuất";
}

/** Entry hạng mục Cống gắn đúng cống (theo congId hoặc lý trình) — chưa lọc cột xuất. */
export function entryLinksToCong(entry, cong) {
  if (!entry || !cong) return false;
  if (!isCongSection(entry)) return false;
  const e = migrateEntry(entry);
  const congId = str(cong.id);
  const entryCongId = str(e.congId || e.assetId || "");
  if (congId && entryCongId && congId === entryCongId) return true;
  const congKm = normalizeKmInput(cong.km);
  const entryKm = normalizeKmInput(e.kmFrom || e.kmTo);
  if (congKm && entryKm && congKm === entryKm) return true;
  return false;
}

/** Entry gắn cống và đã chọn trạng thái xuất (không để trống). */
export function entryMatchesCong(entry, cong) {
  if (!entryLinksToCong(entry, cong)) return false;
  const e = migrateEntry(entry);
  return Boolean(normalizeExportCongStatus(e.exportCongStatus, e.exportCongList));
}

/** Format khối lượng giống sổ tuần đường: «1,00 m²». */
export function formatCongQuantity(entry) {
  const unit = normalizeUnitValue(entry?.unit) || str(entry?.unit);
  const label = formatUnitLabel(unit);
  const q = formatBookDecimal(entry?.quantity);
  if (q) return label ? `${q} ${label}` : q;
  const l = formatBookDecimal(entry?.length);
  const w = formatBookDecimal(entry?.width);
  const h = formatBookDecimal(entry?.height);
  if (unit === "m" && l) return `${l} ${label || "m"}`;
  if (l && w && h) return `${l} × ${w} × ${h}${label ? ` ${label}` : ""}`;
  if (l && w) return `${l} × ${w}${label ? ` ${label}` : ""}`;
  if (l) return `${l}${label ? ` ${label}` : ""}`;
  return "";
}

function historyMetaForExport(exportStatus, entry) {
  const type = str(entry.type);
  const maintenance =
    getMaintenanceNameForType(entry.type) || formatWorkName(entry.type) || "";
  const resolvedText = formatNhatKyResolvedCol(entry) || str(entry.resolved);
  const quantityLabel = formatCongQuantity(entry);

  if (exportStatus === CONG_EXPORT_STATUS.SUA_CHUA) {
    return {
      resolved: true,
      kind: "resolved",
      statusLabel: "SỬA CHỮA",
      detail: type || resolvedText || maintenance || "Đã sửa chữa",
      subDetail: resolvedText && resolvedText !== type ? resolvedText : "",
      quantityLabel
    };
  }
  if (exportStatus === CONG_EXPORT_STATUS.BO_SUNG) {
    return {
      resolved: true,
      kind: "new",
      statusLabel: "BỔ SUNG",
      detail: type || "Bổ sung",
      subDetail: "",
      quantityLabel
    };
  }
  // Hư hỏng (đã chọn xuất)
  return {
    resolved: false,
    kind: "damage",
    statusLabel: "HƯ HỎNG",
    detail: type || "Hư hỏng / sự cố",
    subDetail: "",
    quantityLabel
  };
}

function toHistoryItem(e, exportStatus) {
  const meta = historyMetaForExport(exportStatus, e);
  return {
    entryKey: str(e.recordId || e.id || `${e.date}-${e.kmFrom}-${e.type}`),
    date: str(e.date),
    dateLabel: formatDisplayDate(e.date) || str(e.date),
    type: str(e.type),
    lyTrinh: normalizeKmInput(e.kmFrom) || str(e.kmFrom),
    maintenance: getMaintenanceNameForType(e.type) || formatWorkName(e.type) || "",
    exportStatus,
    ...meta,
    plannedRepairDate: str(e.plannedRepairDate),
    plannedRepairDateLabel: e.plannedRepairDate
      ? formatDisplayDate(e.plannedRepairDate) || str(e.plannedRepairDate)
      : "",
    quantity: e.quantity,
    unit: e.unit,
    content: str(e.content || e.viTriNote)
  };
}

/**
 * Timeline sổ tuần đường (mới → cũ).
 * Chỉ dòng đã chọn «Xuất DS cống». Nếu hồ sơ đã đóng dấu opStatus nhưng dòng sổ
 * thiếu cờ xuất (dữ liệu cũ), lấy dòng cùng lý trình / cùng ngày để hiện chi tiết + KL.
 */
export function buildCongDiaryHistory(entries, cong) {
  const all = (entries || []).map(migrateEntry);
  const exported = all.filter((e) => entryMatchesCong(e, cong));
  let matched = exported;
  const stamped = normalizeExportCongStatus(cong?.opStatus);

  // Heal dữ liệu cũ: đã xuất (có opStatus) nhưng entry thiếu exportCongStatus.
  if (!matched.length && stamped) {
    const at = str(cong?.opStatusAt);
    const linked = all.filter((e) => entryLinksToCong(e, cong));
    const sameDay = at ? linked.filter((e) => str(e.date) === at) : [];
    matched = sameDay.length ? sameDay : linked.slice(0, 3);
  }

  matched.sort((a, b) => {
    const da = str(a.date);
    const db = str(b.date);
    if (da !== db) return db.localeCompare(da);
    return str(b.recordId || b.id).localeCompare(str(a.recordId || a.id));
  });

  return matched.map((e) => {
    const exportStatus =
      normalizeExportCongStatus(e.exportCongStatus, e.exportCongList) || stamped;
    return toHistoryItem(e, exportStatus || CONG_EXPORT_STATUS.HU_HONG);
  });
}

function looksLikeBoSung(cong) {
  if (cong?.group === CONG_GROUP_HU_HONG) return true;
  return /bổ\s*sung|bo\s*sung|mới\s*bổ/i.test(str(cong?.condition));
}

/**
 * Trạng thái hiện tại = bản ghi xuất mới nhất trên sổ;
 * không có sổ thì dùng opStatus đã đóng dấu trên hồ sơ cống.
 */
export function deriveCongOpStatus(cong, history) {
  const latest = (history || [])[0];
  if (latest?.exportStatus === CONG_EXPORT_STATUS.HU_HONG) {
    return CONG_OP_STATUS.HU_HONG;
  }
  if (latest?.exportStatus === CONG_EXPORT_STATUS.SUA_CHUA) {
    return CONG_OP_STATUS.DA_XU_LY;
  }
  if (latest?.exportStatus === CONG_EXPORT_STATUS.BO_SUNG) {
    return CONG_OP_STATUS.BO_SUNG;
  }
  const stamped = normalizeExportCongStatus(cong?.opStatus);
  if (stamped === CONG_EXPORT_STATUS.HU_HONG) return CONG_OP_STATUS.HU_HONG;
  if (stamped === CONG_EXPORT_STATUS.SUA_CHUA) return CONG_OP_STATUS.DA_XU_LY;
  if (stamped === CONG_EXPORT_STATUS.BO_SUNG) return CONG_OP_STATUS.BO_SUNG;
  if (looksLikeBoSung(cong)) return CONG_OP_STATUS.BO_SUNG;
  return CONG_OP_STATUS.BINH_THUONG;
}

export function congOpStatusLabel(status) {
  return CONG_OP_STATUS_LABEL[status] || CONG_OP_STATUS_LABEL[CONG_OP_STATUS.BINH_THUONG];
}

/** Dòng tóm tắt «tình trạng hiện tại» trong drawer. */
export function summarizeCongCurrentStatus(status, history, cong = null) {
  const latest = (history || [])[0];
  const stampedDate = cong?.opStatusAt
    ? formatDisplayDate(cong.opStatusAt) || str(cong.opStatusAt)
    : "";
  const stampedDetail = str(cong?.opStatusDetail);
  const stampedQty = str(cong?.opStatusQuantity);

  function pack(icon, detail, dateLabel, quantityLabel) {
    const qty = quantityLabel ? `, khối lượng: ${quantityLabel}` : "";
    return {
      icon,
      text: `${detail || "—"}${qty}`,
      updatedLabel: dateLabel ? `Ngày: ${dateLabel}` : "",
      dateLabel: dateLabel || "",
      detail: detail || "",
      quantityLabel: quantityLabel || ""
    };
  }

  if (status === CONG_OP_STATUS.HU_HONG) {
    if (latest) {
      return pack(
        "warn",
        latest.detail || latest.type || "Hư hỏng",
        latest.dateLabel,
        latest.quantityLabel
      );
    }
    return pack(
      "warn",
      stampedDetail && stampedDetail !== "Hư hỏng" ? stampedDetail : "Hư hỏng",
      stampedDate,
      stampedQty
    );
  }
  if (status === CONG_OP_STATUS.DA_XU_LY) {
    if (latest) {
      return pack(
        "ok",
        latest.detail || latest.type || "Đã sửa chữa",
        latest.dateLabel,
        latest.quantityLabel
      );
    }
    return pack("ok", stampedDetail || "Đã sửa chữa", stampedDate, stampedQty);
  }
  if (status === CONG_OP_STATUS.BO_SUNG) {
    if (latest) {
      return pack(
        "new",
        latest.detail || latest.type || "Bổ sung",
        latest.dateLabel,
        latest.quantityLabel
      );
    }
    return pack(
      "new",
      stampedDetail || "Cống bổ sung mới",
      stampedDate,
      stampedQty
    );
  }
  return {
    icon: "ok",
    text: "Thoát nước bình thường — chưa xuất trạng thái sang danh sách cống",
    updatedLabel: "",
    dateLabel: "",
    detail: "",
    quantityLabel: ""
  };
}

export function formatCongHeaderSpecs(cong, roadLabel = "") {
  const parts = [];
  const type = formatCongTypeLabel(cong);
  if (type) parts.push(type);
  else if (str(cong?.aperture)) parts.push(str(cong.aperture));
  if (str(cong?.body)) parts.push(str(cong.body));
  if (str(roadLabel)) parts.push(str(roadLabel));
  return parts.join(" | ");
}

/** Map congId → { status, history } cho cả danh sách. */
export function indexCongDiaryStatus(congs, diaryEntries) {
  // Đưa cả hạng mục Cống vào (lọc xuất / heal trong buildCongDiaryHistory).
  const candidates = (diaryEntries || []).filter((raw) => isCongSection(raw));
  const map = new Map();
  (congs || []).forEach((cong) => {
    if (!cong?.id) return;
    const history = buildCongDiaryHistory(candidates, cong);
    const status = deriveCongOpStatus(cong, history);
    map.set(cong.id, { status, history, label: congOpStatusLabel(status) });
  });
  return map;
}
