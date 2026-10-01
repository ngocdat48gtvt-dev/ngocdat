import {
  buildVolumeStats,
  formatStatsNumber,
  normalizeStatsUnit,
  normalizeWorkType,
  parseQuantity,
  dedupeVolumeDetailItems
} from "./volumeStatsFormat";
import { BAO_DUONG_GROUPS } from "./baoDuongQualityStore";

const SECTION_ORDER = Object.fromEntries(BAO_DUONG_GROUPS.map((g, i) => [g, i]));

function normalizeRoadName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Khóa gộp / HĐ báo cáo: đường + hạng mục + đầu việc + ĐVT (không theo USER/sổ). */
export function companyContractKey(row) {
  return [
    normalizeRoadName(row.roadName),
    row.section || "",
    normalizeWorkType(row.workType),
    normalizeStatsUnit(row.unit)
  ].join("|");
}

function recomputeContractFields(totalDone, contractQty) {
  const hasContract = contractQty != null && contractQty > 0;
  const remaining = hasContract ? contractQty - totalDone : null;
  const percent = hasContract ? (totalDone / contractQty) * 100 : null;
  let status = "no_contract";
  if (hasContract) {
    status = remaining <= 0 ? "ok" : "short";
  } else if (totalDone > 0) {
    status = "no_contract";
  } else {
    status = "pending";
  }
  return {
    contractQty: hasContract ? contractQty : null,
    remaining,
    percent,
    status
  };
}

/**
 * Áp HĐ do ADMIN nhập trên cổng Báo cáo (ưu tiên hơn HĐ trên sổ USER).
 * @param {Array} rows
 * @param {Record<string, string|number>} byKey
 */
export function applyCompanyContractOverrides(rows, byKey) {
  const map = byKey && typeof byKey === "object" ? byKey : {};
  return (rows || []).map((row) => {
    const key = companyContractKey(row);
    const raw = map[key];
    const hasOverride = raw != null && String(raw).trim() !== "";
    const contractQty = hasOverride
      ? parseQuantity(raw)
      : row.contractQty != null
        ? Number(row.contractQty)
        : null;
    const fields = recomputeContractFields(row.totalDone || 0, contractQty);
    return {
      ...row,
      ...fields,
      contractKey: key,
      contractFromReport: hasOverride,
      contractInput: hasOverride
        ? String(raw)
        : row.contractQty != null
          ? String(row.contractQty)
          : ""
    };
  });
}

/**
 * Gom KL theo đường + đầu việc (gộp mọi sổ/USER cùng đường cùng tên việc).
 */
export function buildCompanyVolumeRows(sources, options = {}) {
  const {
    dateFrom = "",
    dateTo = "",
    sectionFilter = "",
    hatFilter = "",
    roadFilter = "",
    userFilter = "",
    hatFilters,
    roadFilters,
    userFilters,
    sectionFilters
  } = options;

  const hats = toFilterSet(hatFilters, hatFilter);
  const roads = toFilterSet(roadFilters, roadFilter);
  const users = toFilterSet(userFilters, userFilter);
  const sections = toFilterSet(sectionFilters, sectionFilter);

  const merged = new Map();

  for (const src of sources || []) {
    if (hats && !hats.has(src.hat)) continue;
    if (
      roads &&
      !roads.has(src.roadId) &&
      !roads.has(src.roadName) &&
      !roads.has(normalizeRoadName(src.roadName))
    ) {
      continue;
    }
    if (users && !users.has(src.uid)) continue;

    const stats = buildVolumeStats(src.entries, src.contractVolumes, {
      dateFrom,
      dateTo,
      sectionFilter: ""
    });

    for (const r of stats.rows) {
      if (sections && !sections.has(r.section)) continue;
      if (r.totalDone <= 0 && !(r.contractQty > 0)) continue;

      const roadName = src.roadName || "";
      const workType = r.workType;
      const mergeKey = companyContractKey({
        roadName,
        section: r.section,
        workType,
        unit: r.unit
      });

      if (!merged.has(mergeKey)) {
        merged.set(mergeKey, {
          key: mergeKey,
          uid: src.uid,
          uids: [src.uid],
          userName: src.userName,
          userNames: [src.userName],
          roadId: src.roadId,
          roadIds: [src.roadId],
          roadName,
          hat: src.hat || "—",
          hats: src.hat ? [src.hat] : [],
          kmRange: src.kmRange || "",
          kmRanges: src.kmRange ? [src.kmRange] : [],
          section: r.section,
          workType,
          unit: r.unit,
          unitLabel: r.unitLabel,
          totalDone: 0,
          contractQty: 0,
          hasAnyContract: false,
          entryCount: 0,
          items: []
        });
      }

      const row = merged.get(mergeKey);
      row.totalDone += r.totalDone || 0;
      row.entryCount += r.entryCount || 0;
      if (Array.isArray(r.items) && r.items.length) {
        row.items.push(...r.items);
      }
      if (r.contractQty != null && r.contractQty > 0) {
        row.contractQty += r.contractQty;
        row.hasAnyContract = true;
      }
      if (src.uid && !row.uids.includes(src.uid)) {
        row.uids.push(src.uid);
        row.userNames.push(src.userName);
      }
      if (src.roadId && !row.roadIds.includes(src.roadId)) {
        row.roadIds.push(src.roadId);
      }
      if (src.hat && !row.hats.includes(src.hat)) {
        row.hats.push(src.hat);
      }
      if (src.kmRange && !row.kmRanges.includes(src.kmRange)) {
        row.kmRanges.push(src.kmRange);
      }
    }
  }

  const rows = [...merged.values()].map((row) => {
    const uniqueItems = dedupeVolumeDetailItems(row.items);
    const totalDone = uniqueItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const entryCount = uniqueItems.length;
    const contractQty = row.hasAnyContract ? row.contractQty : null;
    const fields = recomputeContractFields(totalDone, contractQty);
    const userName =
      row.userNames.length <= 1
        ? row.userNames[0] || row.userName || ""
        : row.userNames.join(", ");
    const hat =
      row.hats.length === 0
        ? row.hat || "—"
        : row.hats.length === 1
          ? row.hats[0]
          : row.hats.join(", ");
    const kmRange =
      row.kmRanges.length <= 1 ? row.kmRanges[0] || row.kmRange || "" : row.kmRanges[0];

    return {
      key: row.key,
      uid: row.uids[0] || row.uid,
      uids: row.uids,
      userName,
      roadId: row.roadIds[0] || row.roadId,
      roadName: row.roadName,
      hat,
      kmRange,
      section: row.section,
      workType: row.workType,
      unit: row.unit,
      unitLabel: row.unitLabel,
      totalDone,
      entryCount,
      items: uniqueItems,
      ...fields
    };
  });

  rows.sort((a, b) => {
    const hatCmp = String(a.hat).localeCompare(String(b.hat), "vi");
    if (hatCmp !== 0) return hatCmp;
    const roadCmp = a.roadName.localeCompare(b.roadName, "vi");
    if (roadCmp !== 0) return roadCmp;
    const sa = SECTION_ORDER[a.section] ?? 999;
    const sb = SECTION_ORDER[b.section] ?? 999;
    if (sa !== sb) return sa - sb;
    return a.workType.localeCompare(b.workType, "vi");
  });

  return rows;
}

/** null = không lọc; Set = chỉ giữ giá trị trong set. */
function toFilterSet(arr, single) {
  if (Array.isArray(arr)) {
    if (!arr.length) return null;
    return new Set(arr.map(String));
  }
  const s = String(single || "").trim();
  return s ? new Set([s]) : null;
}

/** Danh sách lọc duy nhất từ sources. */
export function companyVolumeFilterOptions(sources) {
  const hats = new Set();
  const roads = [];
  const roadSeen = new Set();
  const users = [];
  const userSeen = new Set();

  for (const s of sources || []) {
    if (s.hat) hats.add(s.hat);
    const roadKey = normalizeRoadName(s.roadName) || s.roadId;
    if (roadKey && !roadSeen.has(roadKey)) {
      roadSeen.add(roadKey);
      roads.push({
        id: roadKey,
        label: s.roadName || s.roadId,
        hat: s.hat || ""
      });
    }
    if (s.uid && !userSeen.has(s.uid)) {
      userSeen.add(s.uid);
      users.push({ uid: s.uid, displayName: s.userName });
    }
  }

  roads.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  users.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));

  return {
    hats: [...hats].sort((a, b) => a.localeCompare(b, "vi")),
    roads,
    users
  };
}

export function formatCompanyPercent(percent) {
  if (percent == null || !Number.isFinite(percent)) return "—";
  return `${formatStatsNumber(percent)}%`;
}
