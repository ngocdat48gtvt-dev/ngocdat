import { EMPTY_REPORT_META, loadStorage } from "./nhatKyFormat";

function catalogKey(uid) {
  return `nhatky_roads_${uid}`;
}

function legacyStorageKey(uid) {
  return `nhatky_${uid}`;
}

export function getRoadStorageKey(uid, roadId) {
  if (!uid || !roadId) return "nhatky";
  return `nhatky_${uid}_${roadId}`;
}

function newRoadId() {
  return `road_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function stripKmPrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^km\s*/i, "");
}

function formatKmInput(value) {
  const raw = stripKmPrefix(value);
  if (!raw) return "";
  return raw.includes("+") ? `Km${raw}` : raw;
}

export function formatKmDisplay(value) {
  return formatKmInput(value);
}

/** Ghép lý trình hiển thị trên sổ — vd. Km356+700-Km404+000 */
export function buildKmRange(kmFrom, kmTo) {
  const from = formatKmInput(kmFrom);
  const to = formatKmInput(kmTo);
  if (from && to) return `${from}-${to}`;
  return from || to || "";
}

function parseKmRangeString(kmRange) {
  const text = String(kmRange || "").trim();
  if (!text) return { kmFrom: "", kmTo: "" };
  const parts = text.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    return {
      kmFrom: stripKmPrefix(parts[0]),
      kmTo: stripKmPrefix(parts[1])
    };
  }
  return { kmFrom: "", kmTo: "" };
}

function normalizeRoad(road) {
  const roadName = String(road.roadName || road.label || "").trim();
  const hat = String(road.hat || "").trim();
  let kmFrom = String(road.kmFrom || "").trim();
  let kmTo = String(road.kmTo || "").trim();
  let kmRange = String(road.kmRange || "").trim();

  if (!kmFrom && !kmTo && kmRange) {
    const parsed = parseKmRangeString(kmRange);
    kmFrom = parsed.kmFrom;
    kmTo = parsed.kmTo;
  }
  if (kmFrom || kmTo) {
    kmRange = buildKmRange(kmFrom, kmTo);
  }

  const autoLabel =
    roadName && hat
      ? `${roadName} — Hạt ${hat}`
      : roadName || hat || "Đoạn mới";

  return {
    id: road.id || newRoadId(),
    label: String(road.label || autoLabel).trim(),
    roadName,
    hat,
    kmFrom,
    kmTo,
    kmRange,
    company: String(road.company || EMPTY_REPORT_META.company).trim(),
    createdAt: road.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function loadRoadsCatalog(uid) {
  if (!uid) return { activeRoadId: "", roads: [] };
  migrateLegacyStorage(uid);
  try {
    const raw = localStorage.getItem(catalogKey(uid));
    if (!raw) return { activeRoadId: "", roads: [] };
    const parsed = JSON.parse(raw);
    const roads = Array.isArray(parsed.roads)
      ? parsed.roads.map(normalizeRoad)
      : [];
    return {
      activeRoadId: parsed.activeRoadId || "",
      roads
    };
  } catch {
    return { activeRoadId: "", roads: [] };
  }
}

export function saveRoadsCatalog(uid, catalog) {
  if (!uid) return;
  const roads = (catalog.roads || []).map(normalizeRoad);
  localStorage.setItem(
    catalogKey(uid),
    JSON.stringify({
      activeRoadId: catalog.activeRoadId || "",
      roads
    })
  );
}

export function getActiveRoadId(uid) {
  return loadRoadsCatalog(uid).activeRoadId;
}

export function setActiveRoadId(uid, roadId) {
  const catalog = loadRoadsCatalog(uid);
  saveRoadsCatalog(uid, { ...catalog, activeRoadId: roadId || "" });
}

export function findRoad(uid, roadId) {
  return loadRoadsCatalog(uid).roads.find((r) => r.id === roadId) || null;
}

/** Tạo sổ trống cho đường mới (reportMeta theo thông tin đường). */
export function ensureRoadStorage(uid, road) {
  const key = getRoadStorageKey(uid, road.id);
  if (localStorage.getItem(key)) return key;
  const reportMeta = {
    ...EMPTY_REPORT_META,
    company: road.company || EMPTY_REPORT_META.company,
    hat: road.hat || "",
    roadName: road.roadName || road.label || "",
    kmRange: road.kmRange || ""
  };
  localStorage.setItem(
    key,
    JSON.stringify({
      entries: [],
      dayMeta: {},
      reportMeta,
      importMap: {}
    })
  );
  return key;
}

export function addRoad(uid, partial) {
  const catalog = loadRoadsCatalog(uid);
  const road = normalizeRoad(partial);
  const roads = [...catalog.roads, road];
  saveRoadsCatalog(uid, { roads, activeRoadId: catalog.activeRoadId });
  ensureRoadStorage(uid, road);
  return road;
}

export function updateRoad(uid, roadId, patch) {
  const catalog = loadRoadsCatalog(uid);
  const roads = catalog.roads.map((r) =>
    r.id === roadId ? normalizeRoad({ ...r, ...patch, id: roadId }) : r
  );
  saveRoadsCatalog(uid, { ...catalog, roads });
  const updated = roads.find((r) => r.id === roadId) || null;
  if (updated) syncRoadMetaToStorage(uid, updated);
  return updated;
}

export function syncRoadMetaToStorage(uid, road) {
  const key = getRoadStorageKey(uid, road.id);
  if (!localStorage.getItem(key)) return;
  const current = loadStorage(key);
  localStorage.setItem(
    key,
    JSON.stringify({
      ...current,
      reportMeta: {
        ...current.reportMeta,
        company: road.company || current.reportMeta?.company,
        hat: road.hat || "",
        roadName: road.roadName || road.label || "",
        kmRange: road.kmRange || ""
      }
    })
  );
}

export function removeRoad(uid, roadId) {
  const catalog = loadRoadsCatalog(uid);
  const roads = catalog.roads.filter((r) => r.id !== roadId);
  const activeRoadId =
    catalog.activeRoadId === roadId ? "" : catalog.activeRoadId;
  saveRoadsCatalog(uid, { roads, activeRoadId });
  localStorage.removeItem(getRoadStorageKey(uid, roadId));
}

/** Chuyển dữ liệu cũ `nhatky_{uid}` sang sổ đường đầu tiên. */
export function migrateLegacyStorage(uid) {
  if (!uid) return;
  if (localStorage.getItem(catalogKey(uid))) return;

  const legacyKey = legacyStorageKey(uid);
  if (!localStorage.getItem(legacyKey) && localStorage.getItem("nhatky")) {
    localStorage.setItem(legacyKey, localStorage.getItem("nhatky"));
  }

  const legacy = loadStorage(legacyKey);
  const road = normalizeRoad({
    label: legacy.reportMeta?.roadName || "Đường 1",
    roadName: legacy.reportMeta?.roadName || "",
    hat: legacy.reportMeta?.hat || "",
    kmRange: legacy.reportMeta?.kmRange || "",
    company: legacy.reportMeta?.company || EMPTY_REPORT_META.company
  });

  const newKey = getRoadStorageKey(uid, road.id);
  if (localStorage.getItem(legacyKey) && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, localStorage.getItem(legacyKey));
  } else if (!localStorage.getItem(newKey)) {
    ensureRoadStorage(uid, road);
  }

  saveRoadsCatalog(uid, { roads: [road], activeRoadId: road.id });
}

export function roadDisplayLabel(road) {
  if (!road) return "";
  const name = road.roadName || road.label;
  const parts = [];
  if (name) parts.push(name);
  if (road.hat) parts.push(`Hạt ${road.hat}`);
  if (road.kmFrom || road.kmTo) {
    const from = formatKmInput(road.kmFrom) || "…";
    const to = formatKmInput(road.kmTo) || "…";
    parts.push(`${from} → ${to}`);
  } else if (road.kmRange) {
    parts.push(road.kmRange.replace(/-/g, " → "));
  }
  return parts.filter(Boolean).join(" · ");
}

/** Nhóm các hạt theo tên đường để hiển thị danh sách. */
export function groupRoadsByName(roads) {
  const map = new Map();
  for (const road of roads || []) {
    const key = road.roadName || road.label || "Khác";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(road);
  }
  return [...map.entries()].map(([roadName, segments]) => ({
    roadName,
    segments: segments.sort((a, b) => {
      const ka = a.kmFrom || "";
      const kb = b.kmFrom || "";
      return ka.localeCompare(kb, undefined, { numeric: true });
    })
  }));
}
