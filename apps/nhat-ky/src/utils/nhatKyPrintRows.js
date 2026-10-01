import {
  formatLocationCol,
  formatContentCol,
  formatDisplayDate,
  displayDayWeather,
  VISIBLE_SECTIONS,
  compareEntriesByTypeAndKm,
  migrateEntry,
  getDayMeta,
  formatSectionHeading
} from "./nhatKyFormat";
import { annotateDeferredLeaderNotes } from "./baoDuongFormat";

/** Số hàng trống (ước lượng) giữa chức danh và tên trong ô ký. */
export const SIGN_NAME_GAP_ROWS = 3 * 0.8 * 0.85 * 0.8;

/** Khoảng cố định (px) giữa «Tuần đường» và tên. */
export const SIGN_SPACE_PX = Math.round(107 * 0.8 * 0.85 * 0.8);

/** Chiều cao tối thiểu ô ký in (px). */
export const SIGN_CELL_CSS_PX = Math.round(140 * 0.85);

/** Danh sách ngày ISO inclusive từ → đến. */
export function eachIsoDateInclusive(fromIso, toIso) {
  const from = String(fromIso || "").trim();
  const to = String(toIso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

/**
 * Dòng in sổ nhật ký (dữ liệu thuần) — dùng cho bảng A4 landscape 6 cột.
 * kind: weather | part | section | empty | entry
 */
export function buildNhatKyPrintRows(date, items, dayMeta) {
  const allItems = (items || []).map(migrateEntry);
  const rows = [];

  rows.push({
    kind: "weather",
    key: "day-weather",
    c1: formatDisplayDate(date),
    c2: "",
    c3: displayDayWeather(dayMeta?.weather, dayMeta?.weatherDetail) || "",
    c4: "",
    c5: "",
    c6: ""
  });

  let leaderPlaced = false;
  for (const section of VISIBLE_SECTIONS) {
    const sectionItems = allItems
      .filter((x) => x.section === section.title)
      .sort(compareEntriesByTypeAndKm);

    rows.push({
      kind: "section",
      key: `sec-${section.key}`,
      c1: "",
      c2: "",
      c3: formatSectionHeading(section),
      c4: "",
      c5: "",
      c6: ""
    });

    if (!sectionItems.length) {
      rows.push({
        kind: "empty",
        key: `empty-${section.key}`,
        c1: "",
        c2: "",
        c3: "",
        c4: "",
        c5: "",
        c6: ""
      });
      continue;
    }

    const { anns, placed } = annotateDeferredLeaderNotes(sectionItems, {
      alreadyPlaced: leaderPlaced
    });
    leaderPlaced = placed;

    sectionItems.forEach((item, i) => {
      rows.push({
        kind: "entry",
        key: `e-${section.key}-${i}`,
        c1: item.time || "",
        c2: formatLocationCol(item),
        c3: formatContentCol(item, ""),
        c4: item.resolved || item.solution || "",
        c5: anns[i]?.note || item.leaderNote || "",
        c6: item.inspectorNote || item.note || ""
      });
    });
  }

  return rows;
}

export function entriesForDate(entries, date) {
  return (entries || []).map(migrateEntry).filter((x) => x.date === date);
}

export function dayMetaForDate(dayMetaMap, date) {
  return getDayMeta(dayMetaMap, date);
}
