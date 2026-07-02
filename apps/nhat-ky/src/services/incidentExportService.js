import {
  buildIncidentExportWorkbook,
  isBaoLuExport,
  sortIncidentsForExport
} from "../lib/excelReportBuilder.js";
import { computeKhoiLuong, resolveIncidentUnit } from "../utils/incidentUtils.js";
import { buildIncidentWordReport } from "../lib/wordReportBuilder.js";

function isoToFileDate(iso) {
  if (!iso?.trim()) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y}`;
}

function todayFileDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
}

export function buildBaoCaoSuCoFilename(items, filters) {
  const fromFilter = isoToFileDate(filters?.dateFrom);
  const toFilter = isoToFileDate(filters?.dateTo);
  if (fromFilter || toFilter) {
    const from = fromFilter || toFilter || todayFileDate();
    const to = toFilter || fromFilter || from;
    return `Bao cao su co tu ngay ${from} den ${to}.xlsx`;
  }

  const sorted = sortIncidentsForExport(items);
  const start = sorted[0]?.date?.replace(/\//g, "-") ?? todayFileDate();
  const end = sorted[sorted.length - 1]?.date?.replace(/\//g, "-") ?? start;
  return `Bao cao su co tu ngay ${start} den ${end}.xlsx`;
}

/** Xuất Excel — viền, căn chữ, công thức khớp app ExcelExporter. */
export async function exportIncidentsExcel(items, filename, options) {
  const baoLuMode = isBaoLuExport(options?.groupFilter, items);
  const wb = await buildIncidentExportWorkbook(items, baoLuMode);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function matchesWordVolumeFilter(inc, under100, over100) {
  if (!under100 && !over100) return false;
  const unit = resolveIncidentUnit(inc);
  if (unit !== "m³") return under100 || over100;
  const vol = computeKhoiLuong(inc);
  return vol <= 100 ? under100 : over100;
}

export function buildBaoCaoAnhFilename(items, filters) {
  const fromFilter = isoToFileDate(filters?.dateFrom);
  const toFilter = isoToFileDate(filters?.dateTo);
  if (fromFilter || toFilter) {
    const from = fromFilter || toFilter || todayFileDate();
    const to = toFilter || fromFilter || from;
    return `Bao cao anh su co tu ngay ${from} den ngay ${to}.docx`;
  }
  const sorted = sortIncidentsForExport(items);
  const start = sorted[0]?.date?.replace(/\//g, "-") ?? todayFileDate();
  const end = sorted[sorted.length - 1]?.date?.replace(/\//g, "-") ?? start;
  return `Bao cao anh su co tu ngay ${start} den ngay ${end}.docx`;
}

/** Xuất Word ghép ảnh hiện trạng + sau xử lý. Trả về số ảnh tải lỗi. */
export async function exportIncidentsWord(items, filename, options, onProgress) {
  const { blob, failedImages } = await buildIncidentWordReport(items, options, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  return failedImages;
}
