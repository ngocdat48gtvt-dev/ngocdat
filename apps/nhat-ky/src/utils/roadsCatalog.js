import {
  EMPTY_REPORT_META,
  extractBranchParenCode,
  hasStorage,
  loadStorage,
  saveStorage
} from "./nhatKyFormat";

const memoryRoadCatalogs = new Map();

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

function newRouteId() {
  return `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

/** Một đường / nhánh trong sổ tuần đường. */
export function normalizeRoute(route = {}) {
  const roadName = String(route.roadName || "").trim();
  let kmFrom = String(route.kmFrom || "").trim();
  let kmTo = String(route.kmTo || "").trim();
  let kmRange = String(route.kmRange || "").trim();

  if (!kmFrom && !kmTo && kmRange) {
    const parsed = parseKmRangeString(kmRange);
    kmFrom = parsed.kmFrom;
    kmTo = parsed.kmTo;
  }
  if (kmFrom || kmTo) {
    kmRange = buildKmRange(kmFrom, kmTo);
  }

  const existing = String(route.id || "").trim();
  const computed = stableRouteId(roadName, kmFrom, kmTo);
  // Form «+ Thêm nhánh» từng gán chung id rt___ → React chỉ hiện 1 dòng.
  const emptyStable = stableRouteId("", "", "");
  let id = existing;
  if (!id || id === emptyStable) {
    id = roadName || kmFrom || kmTo ? computed : newRouteId();
  }

  return {
    id,
    roadName,
    kmFrom,
    kmTo,
    kmRange
  };
}

/** Id ổn định theo tên+km — tránh mỗi lần load sinh id mới rồi lọc sai. */
function stableRouteId(roadName, kmFrom, kmTo) {
  const name = String(roadName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const from = String(kmFrom || "").replace(/\s+/g, "");
  const to = String(kmTo || "").replace(/\s+/g, "");
  const key = `rt_${name}_${from}_${to}`.replace(/[^\w.+-]/g, "");
  return key || newRouteId();
}

/**
 * Danh sách đường/nhánh của sổ.
 * Sổ cũ (1 đường) → 1 phần tử suy ra từ roadName/km.
 * Cùng tên nhưng khác km vẫn giữ tách (phân biệt khi chọn đường).
 */
export function getRoadRoutes(road) {
  if (!road) return [];
  return extractRoadRoutes(road);
}

export function findRoute(road, routeId) {
  const routes = getRoadRoutes(road);
  if (!routes.length) return null;
  if (!routeId) return routes[0];
  return routes.find((r) => String(r.id) === String(routeId)) || routes[0];
}

/**
 * Chọn nhánh đang xem từ list routes — khớp id tuyệt đối, không ngầm nhảy về nhánh đầu.
 */
export function pickActiveRoute(routes, activeRouteId) {
  const list = Array.isArray(routes) ? routes : [];
  if (!list.length) return null;
  const id = String(activeRouteId || "").trim();
  if (id) {
    const hit = list.find((r) => String(r.id) === id);
    if (hit) return hit;
  }
  return list[0] || null;
}

/**
 * Cống/cầu (hoặc bản ghi có km / routeId) có thuộc nhánh đang chọn không.
 * Nhiều nhánh: ưu tiên routeId; không có thì lọc theo lý trình nằm trong đoạn km.
 */
export function assetMatchesRoute(entry, route, siblingRoutes = []) {
  if (!route) return true;
  const siblings = Array.isArray(siblingRoutes) && siblingRoutes.length
    ? siblingRoutes
    : [route];
  if (siblings.length <= 1) return true;

  const rid = String(entry?.routeId || "").trim();
  const routeId = String(route.id || "").trim();
  if (rid && routeId && rid === routeId) return true;
  if (rid && siblings.some((r) => String(r.id) === rid)) return false;

  return entryOverlapsRouteKm(entry, route);
}

export function filterAssetsForRoute(list, route, siblingRoutes = []) {
  const siblings = Array.isArray(siblingRoutes) ? siblingRoutes : [];
  if (!route || siblings.length <= 1) return Array.isArray(list) ? list : [];
  return (list || []).filter((e) => assetMatchesRoute(e, route, siblings));
}

/** Gắn roadName/km đang ghi theo một route (không đổi id sổ). */
export function withActiveRoute(road, routeId) {
  if (!road) return null;
  const route = findRoute(road, routeId);
  if (!route) return road;
  return {
    ...road,
    roadName: route.roadName,
    kmFrom: route.kmFrom,
    kmTo: route.kmTo,
    kmRange: route.kmRange,
    activeRouteId: route.id,
    routesViewMode: "split"
  };
}

/** Ghép tên đường khi gộp (tiêu đề sổ). */
export function formatMergedRoadNames(routes) {
  const names = (routes || [])
    .map((r) => formatRoadNameForBookTitle(r.roadName))
    .filter(Boolean);
  return [...new Set(names)].join("; ");
}

/**
 * Tên đường trên tiêu đề sổ: QL.6C → QL6C; (TL đến CN) → (TL-CN).
 */
export function formatRoadNameForBookTitle(name) {
  let s = String(name || "").trim();
  if (!s) return "";
  s = s.replace(/([A-Za-zÀ-ỹ]+)\.(\d)/g, "$1$2");
  s = s.replace(/\(\s*([^)]+?)\s*\)\s*$/u, (_, inner) => {
    const compact = String(inner)
      .replace(/\s*(đến|tới|→|->|–|—|-)\s*/giu, "-")
      .replace(/\s+/g, "");
    return `(${compact})`;
  });
  return s;
}

/**
 * Ghép lý trình khi gộp (tiêu đề sổ) — cùng tên đường gộp km min–max.
 * VD: «QL6C (TL-CN) đoạn Km0+000 - Km56+000; QL6C (KC-LK) đoạn Km0+000 - Km13+200»
 */
export function formatMergedKmRanges(routes) {
  const list = routes || [];
  const nameOrder = [];
  const byName = new Map();
  for (const r of list) {
    const name = String(r.roadName || "").trim();
    const key = roadNameKey(name) || String(r.id || Math.random());
    if (!byName.has(key)) {
      byName.set(key, []);
      nameOrder.push(key);
    }
    byName.get(key).push(r);
  }
  const parts = [];
  for (const key of nameOrder) {
    const group = byName.get(key) || [];
    const span = mergeSameNameRouteSpan(group);
    if (!span) continue;
    const from = formatKmInput(span.kmFrom) || "…";
    const to = formatKmInput(span.kmTo) || "…";
    const name = formatRoadNameForBookTitle(span.roadName);
    parts.push(name ? `${name} đoạn ${from} - ${to}` : `đoạn ${from} - ${to}`);
  }
  return parts.join("; ");
}

/**
 * Dòng lý trình đầu sổ (mặt đường / BDTX / bão lũ / hành lang / TNGT…).
 * Ưu tiên kmRange đã format; một cung đơn → «Tên đoạn Km… - Km…».
 */
export function formatBookKmTitleLine(reportMeta, { prefix = "" } = {}) {
  const rawRange = String(reportMeta?.kmRange || "").trim();
  const road = formatRoadNameForBookTitle(reportMeta?.roadName || "");
  if (!rawRange && !road) return prefix || "";

  let body = "";
  if (/đoạn\s+Km/iu.test(rawRange) || (rawRange.includes(";") && /Km/i.test(rawRange))) {
    body = rawRange
      .replace(/\bkm/gi, "Km")
      .replace(/\s*→\s*/g, " - ")
      .replace(/\s*:\s*/g, " đoạn ");
    // Chuẩn hoá tên trong từng đoạn nếu còn dạng cũ «Tên: Km…»
    body = body
      .split(/\s*;\s*/)
      .map((part) => {
        const m = part.match(/^(.+?)\s+đoạn\s+(.+)$/iu);
        if (!m) return part.trim();
        const name = formatRoadNameForBookTitle(m[1]);
        const kms = String(m[2] || "")
          .replace(/\s*→\s*/g, " - ")
          .replace(/\s*-\s*/g, " - ")
          .trim();
        return name ? `${name} đoạn ${kms}` : `đoạn ${kms}`;
      })
      .filter(Boolean)
      .join("; ");
  } else {
    let range = rawRange
      .replace(/\bkm/gi, "Km")
      .replace(/\s*→\s*/g, " - ")
      .replace(/\s*[-–—]\s*/g, " - ")
      .trim();
    // «Km0+000 đến Km56+000» → «Km0+000 - Km56+000»
    range = range.replace(/\s+đến\s+/gi, " - ");
    if (road && range) body = `${road} đoạn ${range}`;
    else body = range || road;
  }

  if (!body) return prefix || "";
  return prefix ? `${prefix} ${body}`.trim() : body;
}

/**
 * Tiêu đề sổ theo chế độ tách/gộp.
 * - split: theo đường đang chọn
 * - merged: gộp các đường trong titleRouteIds (mặc định tất cả)
 */
export function withRoadTitleView(road, routeId, routesViewMode = "split", titleRouteIds) {
  if (!road) return null;
  const routes = getRoadRoutes(road);
  const mode =
    routes.length > 1 && routesViewMode === "merged" ? "merged" : "split";
  if (mode === "merged") {
    const idSet =
      Array.isArray(titleRouteIds) && titleRouteIds.length
        ? new Set(titleRouteIds.map(String))
        : null;
    const picked = idSet
      ? routes.filter((r) => idSet.has(String(r.id)))
      : routes;
    const useRoutes = picked.length ? picked : routes;
    const active = findRoute(road, routeId) || useRoutes[0] || routes[0];
    return {
      ...road,
      roadName: formatMergedRoadNames(useRoutes) || road.roadName || "",
      kmFrom: useRoutes[0]?.kmFrom || "",
      kmTo: useRoutes[useRoutes.length - 1]?.kmTo || "",
      kmRange: formatMergedKmRanges(useRoutes) || road.kmRange || "",
      activeRouteId: active?.id || "",
      routesViewMode: "merged",
      titleRouteIds: useRoutes.map((r) => r.id)
    };
  }
  return withActiveRoute(road, routeId);
}

function routesViewStorageKey(uid, roadId) {
  return `nhatky_routes_view_${uid}_${roadId}`;
}

function titleRoutesStorageKey(uid, roadId) {
  return `nhatky_title_routes_${uid}_${roadId}`;
}

/** Mặc định gộp mọi nhánh để xem đủ đường; user tách khi cần. */
export function defaultRoutesViewMode(road) {
  const routes = getRoadRoutes(road);
  if (routes.length <= 1) return "merged";
  return "merged";
}

export function getRoutesViewMode(uid, road) {
  if (!road) return "merged";
  const routes = getRoadRoutes(road);
  if (routes.length <= 1) return "merged";
  if (!uid || !road.id) return defaultRoutesViewMode(road);
  try {
    const stored = localStorage.getItem(routesViewStorageKey(uid, road.id));
    if (stored === "split" || stored === "merged") return stored;
  } catch {
    /* ignore */
  }
  return defaultRoutesViewMode(road);
}

export function setRoutesViewMode(uid, roadId, mode) {
  if (!uid || !roadId) return;
  const next = mode === "merged" ? "merged" : "split";
  try {
    localStorage.setItem(routesViewStorageKey(uid, roadId), next);
  } catch {
    /* ignore */
  }
  return next;
}

/** Danh sách route id đưa lên tiêu đề khi gộp (rỗng = tất cả). */
export function getTitleRouteIds(uid, road) {
  const routes = getRoadRoutes(road);
  if (!routes.length) return [];
  if (!uid || !road?.id) return routes.map((r) => r.id);
  try {
    const raw = localStorage.getItem(titleRoutesStorageKey(uid, road.id));
    if (!raw) return routes.map((r) => r.id);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return routes.map((r) => r.id);
    const valid = parsed.map(String).filter((id) => routes.some((r) => String(r.id) === id));
    return valid.length ? valid : routes.map((r) => r.id);
  } catch {
    return routes.map((r) => r.id);
  }
}

export function setTitleRouteIds(uid, roadId, routeIds) {
  if (!uid || !roadId) return [];
  const ids = Array.isArray(routeIds) ? routeIds.map(String).filter(Boolean) : [];
  try {
    localStorage.setItem(titleRoutesStorageKey(uid, roadId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  return ids;
}

export function routeNameLabel(route) {
  if (!route) return "";
  return String(route.roadName || "").trim();
}

export function routeKmLabel(route) {
  if (!route) return "";
  if (route.kmFrom || route.kmTo) {
    const from = formatKmInput(route.kmFrom) || "…";
    const to = formatKmInput(route.kmTo) || "…";
    return `${from} → ${to}`;
  }
  if (route.kmRange) return String(route.kmRange).replace(/-/g, " → ").trim();
  return "";
}

export function routeDisplayLabel(route) {
  if (!route) return "";
  const parts = [routeNameLabel(route), routeKmLabel(route)].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Key cloud hồ sơ cầu/cống theo từng nhánh.
 * Cùng tên (TL-CN 0–22 vs 22–56) vẫn tách bằng km / routeId.
 */
export function routeRegistryCloudKey(route) {
  if (!route) return "";
  const name = routeNameLabel(route);
  const from = String(route.kmFrom || "").trim();
  const to = String(route.kmTo || "").trim();
  if (name && (from || to)) {
    return `${name}|${from}|${to}`;
  }
  const id = String(route.id || "").trim();
  if (name && id) return `${name}#${id}`;
  if (id) return `rt:${id}`;
  return name;
}

/** Mét quy đổi để so Km (số thuần coi là km nguyên: 22 → Km22+000). */
function routePointMeters(value) {
  const raw = stripKmPrefix(value);
  if (!raw) return null;
  if (raw.includes("+")) {
    const [a, b] = raw.split("+", 2);
    const km = Number(String(a).replace(/\D/g, "")) || 0;
    const m = Number(String(b).replace(/\D/g, "")) || 0;
    return km * 1000 + m;
  }
  const n = Number(String(raw).replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 1000);
}

function roadNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function roadNamesMatch(a, b) {
  const ka = roadNameKey(a);
  const kb = roadNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const na = formatRoadNameForBookTitle(ka);
  const nb = formatRoadNameForBookTitle(kb);
  return Boolean(na && nb && na === nb);
}

function branchCodeKey(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/\s+/g, "");
}

function routeBranchKey(route) {
  return branchCodeKey(extractBranchParenCode(routeNameLabel(route)));
}

function entryBranchKey(entry) {
  const fromName = branchCodeKey(extractBranchParenCode(entry?.roadName));
  if (fromName) return fromName;
  const loc = String(
    entry?.location || entry?.lyTrinh || entry?.locationNote || ""
  );
  const m = loc.match(/nhánh\s+([^,;]+)/i);
  return m ? branchCodeKey(m[1]) : "";
}

function routesMatchingBranchOrName(routes, entry) {
  if (!Array.isArray(routes) || !routes.length) return [];
  const bk = entryBranchKey(entry);
  if (bk) {
    const byBranch = routes.filter((r) => routeBranchKey(r) === bk);
    if (byBranch.length) return byBranch;
  }
  const name = String(entry?.roadName || "").trim();
  if (name) {
    const byName = routes.filter((r) => roadNamesMatch(name, routeNameLabel(r)));
    if (byName.length) return byName;
  }
  return routes;
}

function pickRouteByKm(candidates, entry) {
  const hits = (candidates || []).filter((r) => entryOverlapsRouteKm(entry, r));
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const points = entryKmMetersList(entry);
  const mid = points.length
    ? (Math.min(...points) + Math.max(...points)) / 2
    : null;
  let pool = hits;
  if (mid != null) {
    const containing = hits.filter((r) => {
      const b = routeKmBounds(r);
      return b && mid >= b.min && mid <= b.max;
    });
    if (containing.length) pool = containing;
  }
  const entryBk = entryBranchKey(entry);
  if (entryBk) {
    const byBranch = pool.filter((r) => routeBranchKey(r) === entryBk);
    if (byBranch.length) pool = byBranch;
  }
  const name = String(entry?.roadName || "").trim();
  if (name) {
    const byName = pool.filter((r) => roadNamesMatch(name, routeNameLabel(r)));
    if (byName.length) pool = byName;
  }
  if (pool.length > 1) {
    const branches = new Set(pool.map(routeBranchKey).filter(Boolean));
    // TL-CN và KC-LK trùng lý trình: không đoán nhánh đầu tiên.
    if (branches.size > 1 && !entryBk) return null;
    pool = [...pool].sort((a, b) => {
      const ba = routeKmBounds(a);
      const bb = routeKmBounds(b);
      const sa = ba ? ba.max - ba.min : Number.POSITIVE_INFINITY;
      const sb = bb ? bb.max - bb.min : Number.POSITIVE_INFINITY;
      return sa - sb;
    });
  }
  return pool[0] || null;
}

/** Gán bản ghi vào đúng 1 cung — ưu tiên routeId người dùng đã chọn khi nhập. */
function resolveEntryCatalogRoute(entry, allRoutes) {
  const all = Array.isArray(allRoutes) ? allRoutes : [];
  if (!all.length) return null;
  const er = String(entry?.routeId || "").trim();
  if (er) {
    const byId = all.find((r) => String(r.id) === er) || null;
    if (byId) return byId;
  }
  const points = entryKmMetersList(entry);
  const pool = routesMatchingBranchOrName(all, entry);

  if (points.length) {
    const byKm = pickRouteByKm(pool, entry);
    if (byKm) return byKm;
  }

  if (!points.length && pool.length === 1 && pool.length < all.length) {
    return pool[0];
  }
  return null;
}

export function uniquifyRouteIds(routes) {
  const seen = new Set();
  return (Array.isArray(routes) ? routes : []).map((r) => {
    let id = String(r?.id || "").trim();
    if (!id || seen.has(id)) {
      id = stableRouteId(r?.roadName, r?.kmFrom, r?.kmTo);
      if (!id || seen.has(id)) id = newRouteId();
    }
    seen.add(id);
    return id === r.id ? r : { ...r, id };
  });
}

function extractRoadRoutes(road) {
  if (!road) return [];
  if (Array.isArray(road.routes) && road.routes.length > 0) {
    const list = road.routes
      .map((r) => normalizeRoute(r))
      .filter((r) => r.roadName || r.kmFrom || r.kmTo);
    return uniquifyRouteIds(list);
  }
  let kmFrom = String(road.kmFrom || "").trim();
  let kmTo = String(road.kmTo || "").trim();
  let kmRange = String(road.kmRange || "").trim();
  if (!kmFrom && !kmTo && kmRange) {
    const parsed = parseKmRangeString(kmRange);
    kmFrom = parsed.kmFrom;
    kmTo = parsed.kmTo;
  }
  const name = String(road.roadName || road.label || "").trim();
  if (!name && !kmFrom && !kmTo) return [];
  return [
    normalizeRoute({
      id: road.id ? `${road.id}_main` : undefined,
      roadName: name,
      kmFrom,
      kmTo,
      kmRange
    })
  ];
}

function routeKmBounds(route) {
  let a = routePointMeters(route?.kmFrom);
  let b = routePointMeters(route?.kmTo);
  if (a == null && b == null) return null;
  if (a == null) return { min: b, max: b };
  if (b == null) return { min: a, max: a };
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

/** Lấy các điểm km trên bản ghi (để lọc theo cung đường). */
function entryKmMetersList(entry) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const m = routePointMeters(v);
    if (m == null || seen.has(m)) return;
    seen.add(m);
    out.push(m);
  };
  push(entry?.kmFrom);
  push(entry?.kmTo);
  push(entry?.km);
  const loc = String(entry?.location || entry?.lyTrinh || entry?.locationNote || "");
  const kmTokens = loc.match(/Km\s*\d+(?:\s*\+\s*\d{1,3})?/gi) || [];
  for (const part of kmTokens) push(part);
  if (!out.length) {
    const bare = loc.match(/\b\d+\+\d{1,3}\b/g) || [];
    for (const part of bare) push(part);
  }
  return out;
}

function entryOverlapsRouteKm(entry, route) {
  const bounds = routeKmBounds(route);
  if (!bounds) return false;
  const points = entryKmMetersList(entry);
  if (!points.length) return false;
  return points.some((m) => m >= bounds.min && m <= bounds.max);
}

/**
 * Đường đang xem trên sổ theo Tách / Gộp.
 * - Tách: 1 đường đang chọn
 * - Gộp: các đường được tick (mặc định tất cả)
 */
export function resolveViewRoutes(
  road,
  { routesViewMode = "merged", activeRouteId = "", titleRouteIds } = {}
) {
  const routes = getRoadRoutes(road);
  if (routes.length <= 1) return routes;
  if (routesViewMode === "merged") {
    const idSet =
      Array.isArray(titleRouteIds) && titleRouteIds.length
        ? new Set(titleRouteIds.map(String))
        : null;
    if (!idSet) return routes;
    const picked = routes.filter((r) => idSet.has(String(r.id)));
    return picked;
  }
  const active = findRoute(road, activeRouteId);
  return active ? [active] : [routes[0]];
}

/**
 * Bản ghi có thuộc các đường đang xem không.
 * Ưu tiên lý trình nằm trong đoạn đã chọn (TL-CN 0–22 ≠ 22–56).
 */
export function entryMatchesRouteView(entry, viewRoutes, allRoutes) {
  const all = allRoutes || [];
  const allowed = Array.isArray(viewRoutes) ? viewRoutes : all;
  if (!all.length || all.length <= 1) return true;
  if (!allowed.length) return false;
  if (allowed.length >= all.length) return true;

  const rid = String(entry?.routeId || "").trim();
  if (rid) {
    if (allowed.some((r) => String(r.id) === rid)) return true;
    if (all.some((r) => String(r.id) === rid)) return false;
  }

  const resolved = resolveEntryCatalogRoute(entry, all);
  if (resolved) {
    return allowed.some((r) => String(r.id) === String(resolved.id));
  }
  // Trùng km nhiều nhánh (TL-CN / KC-LK): không đưa vào sổ đang tách.
  return false;
}

export function filterEntriesByRouteView(entries, road, opts = {}) {
  const allRoutes = getRoadRoutes(road);
  if (allRoutes.length <= 1) return entries || [];
  const viewRoutes = resolveViewRoutes(road, opts);
  if (!viewRoutes.length) return entries || [];
  return (entries || []).filter((e) => entryMatchesRouteView(e, viewRoutes, allRoutes));
}

/**
 * Gán bản ghi vào 1 nhánh đang xem (ưu tiên routeId, rồi theo km).
 * Không khớp → null (nhóm «Khác» khi gộp nhiều nhánh).
 */
export function assignEntryToViewRoute(entry, viewRoutes, allRoutes) {
  const all = allRoutes?.length ? allRoutes : viewRoutes || [];
  const allowed = viewRoutes?.length ? viewRoutes : all;
  if (!allowed.length) return null;
  const rid = String(entry?.routeId || "").trim();
  if (rid) {
    const inView = allowed.find((r) => String(r.id) === rid);
    if (inView) return inView;
    if (all.some((r) => String(r.id) === rid)) return null;
  }
  const fromView = resolveEntryCatalogRoute(entry, allowed);
  if (fromView) return fromView;
  const fromAll = resolveEntryCatalogRoute(entry, all);
  if (fromAll && allowed.some((r) => String(r.id) === String(fromAll.id))) {
    return fromAll;
  }
  return null;
}

/** Tên đường của bản ghi — ưu tiên field roadName, rồi routeId / km khi gộp nhánh. */
export function resolveEntryRoadName(entry, road, viewOpts = {}) {
  const named = String(entry?.roadName || "").trim();
  if (named) return named;
  const allRoutes = getRoadRoutes(road);
  if (allRoutes.length <= 1) return routeNameLabel(allRoutes[0]) || "";
  const viewRoutes = resolveViewRoutes(road, viewOpts);
  const route = assignEntryToViewRoute(entry, viewRoutes, allRoutes);
  return routeNameLabel(route) || "";
}

/** true khi đang gộp ≥2 nhánh trên sổ. */
export function isMergedMultiRouteView(road, viewOpts = {}) {
  const viewRoutes = resolveViewRoutes(road, viewOpts);
  return viewOpts.routesViewMode === "merged" && viewRoutes.length > 1;
}

/** Số La Mã hoa: 1→I, 2→II, … (đủ cho số nhánh thực tế). */
export function toRomanUpper(n) {
  const num = Math.floor(Number(n));
  if (!Number.isFinite(num) || num < 1) return String(n);
  const map = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let x = num;
  let out = "";
  for (const [v, s] of map) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return out;
}

/** «I. QL6C (TL-CN) đoạn Km0+000 - Km38+400» */
export function formatRouteSegmentTitle(route, index = 0) {
  const name = formatRoadNameForBookTitle(routeNameLabel(route)) || "Đường";
  const from =
    formatKmInput(route?.kmFrom) ||
    (route?.kmRange ? String(route.kmRange).split(/[-–→]/)[0]?.trim() : "") ||
    "…";
  const to =
    formatKmInput(route?.kmTo) ||
    (route?.kmRange
      ? String(route.kmRange)
          .split(/[-–→]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .pop()
      : "") ||
    "…";
  return `${toRomanUpper(index + 1)}. ${name} đoạn ${from} - ${to}`;
}

/** Mét → «Km15+000» (tiêu đề đoạn đã gộp cùng tên đường). */
function metersToKmTitle(totalM) {
  if (!Number.isFinite(totalM) || totalM < 0) return "";
  const km = Math.floor(totalM / 1000);
  const m = Math.round(totalM % 1000);
  return `Km${km}+${String(m).padStart(3, "0")}`;
}

/**
 * Gộp các cung cùng tên đường → một span km min–max (vd. TL-CN 0–22 + 22–56 → 0–56).
 */
export function mergeSameNameRouteSpan(routes) {
  const list = (routes || []).filter(Boolean);
  if (!list.length) return null;
  const name = routeNameLabel(list[0]) || "Đường";
  let minM = Infinity;
  let maxM = -Infinity;
  for (const r of list) {
    const bounds = routeKmBounds(r);
    if (!bounds) continue;
    minM = Math.min(minM, bounds.min);
    maxM = Math.max(maxM, bounds.max);
  }
  const kmFrom = Number.isFinite(minM) ? metersToKmTitle(minM).replace(/^Km/i, "") : list[0].kmFrom;
  const kmTo = Number.isFinite(maxM) ? metersToKmTitle(maxM).replace(/^Km/i, "") : list[0].kmTo;
  return normalizeRoute({
    id: list.map((r) => r.id).filter(Boolean).join("+") || list[0].id,
    roadName: name,
    kmFrom,
    kmTo
  });
}

/**
 * Khi gộp ≥2 nhánh: nhóm theo tên đường (cùng tên → một tiêu đề, gộp km).
 * «I. QL6C (TL-CN) đoạn Km0+000 - Km35+000»
 * Tách đường / 1 nhánh: một nhóm; sổ BDTX vẫn hiện tiêu đề đoạn.
 * @param {object[]} [opts.items] — nếu có thì giữ nguyên item (vd. {entry, globalIndex})
 * @param {(item)=>object} [opts.getEntry]
 * @param {boolean} [opts.forceRouteHeadings]
 */
export function groupEntriesByRouteSections(entriesOrItems, road, viewOpts = {}, opts = {}) {
  const getEntry =
    typeof opts.getEntry === "function"
      ? opts.getEntry
      : (x) => (x && typeof x === "object" && "entry" in x ? x.entry : x);
  const asItems = Array.isArray(opts.items)
    ? opts.items
    : (entriesOrItems || []).map((x) =>
        x && typeof x === "object" && "entry" in x ? x : { entry: x }
      );
  const orphanLabel = opts.orphanLabel || "Công việc khác";
  const forceHeadings = Boolean(opts.forceRouteHeadings);

  const allRoutes = getRoadRoutes(road);
  const viewRoutes = resolveViewRoutes(road, viewOpts);
  const mergedMulti =
    viewOpts.routesViewMode === "merged" && viewRoutes.length > 1;

  if (!mergedMulti) {
    const route = viewRoutes[0] || null;
    return [
      {
        heading:
          forceHeadings && route ? formatRouteSegmentTitle(route, 0) : null,
        routeId: route?.id || "",
        items: asItems
      }
    ];
  }

  const nameOrder = [];
  const byName = new Map();
  for (const r of viewRoutes) {
    const key = roadNameKey(routeNameLabel(r)) || String(r.id);
    if (!byName.has(key)) {
      byName.set(key, []);
      nameOrder.push(key);
    }
    byName.get(key).push(r);
  }

  const buckets = new Map();
  for (const key of nameOrder) buckets.set(key, []);
  const orphan = [];

  for (const item of asItems) {
    const entry = getEntry(item);
    const route = assignEntryToViewRoute(entry, viewRoutes, allRoutes);
    const key = route
      ? roadNameKey(routeNameLabel(route)) || String(route.id)
      : "";
    if (key && buckets.has(key)) {
      buckets.get(key).push(item);
    } else {
      orphan.push(item);
    }
  }

  const sections = [];
  let headingIdx = 0;
  for (const key of nameOrder) {
    const group = byName.get(key) || [];
    const items = buckets.get(key) || [];
    if (!items.length) continue;
    const span = mergeSameNameRouteSpan(group);
    sections.push({
      heading: formatRouteSegmentTitle(span || group[0], headingIdx),
      routeId: span?.id || group[0]?.id || "",
      items
    });
    headingIdx += 1;
  }
  if (orphan.length) {
    sections.push({
      heading: `${toRomanUpper(headingIdx + 1)}. ${orphanLabel}`,
      routeId: "",
      items: orphan
    });
  }
  return sections.length
    ? sections
    : [{ heading: null, routeId: "", items: asItems }];
}

/**
 * Blocks render: routeHeader + entry (stt liên tục; isSectionStart để in nhiều tờ).
 */
export function buildRouteDisplayBlocks(entriesOrItems, road, viewOpts = {}, opts = {}) {
  const getEntry =
    typeof opts.getEntry === "function"
      ? opts.getEntry
      : (x) => (x && typeof x === "object" && "entry" in x ? x.entry : x);
  const sections = groupEntriesByRouteSections(entriesOrItems, road, viewOpts, opts);
  const blocks = [];
  let stt = 0;
  for (const sec of sections) {
    if (sec.heading) {
      blocks.push({
        kind: "routeHeader",
        heading: sec.heading,
        routeId: sec.routeId || "",
        key: `hdr-${sec.routeId || "other"}-${sec.heading}`
      });
    }
    let sectionIdx = 0;
    for (const item of sec.items) {
      stt += 1;
      sectionIdx += 1;
      const entry = getEntry(item);
      blocks.push({
        kind: "entry",
        item,
        entry,
        stt,
        routeId: sec.routeId || "",
        heading: sec.heading || "",
        isSectionStart: Boolean(sec.heading) && sectionIdx === 1,
        key: `e-${stt}-${entry?.date || ""}-${entry?.kmFrom || ""}-${entry?.id || ""}`
      });
    }
  }
  return blocks;
}

/** Entries đã xếp theo nhánh (dùng trước khi pack trang in). */
export function orderEntriesByRouteSections(entries, road, viewOpts = {}, opts = {}) {
  return buildRouteDisplayBlocks(entries, road, viewOpts, opts)
    .filter((b) => b.kind === "entry")
    .map((b) => b.entry);
}

/**
 * Ghép blocks (có tiêu đề nhánh) cho 1 tờ in từ chunk entries đã pack.
 * Chỉ hiện tiêu đề ở bản ghi đầu mỗi nhánh (không lặp khi nhánh sang tờ sau).
 */
export function blocksForPackedEntries(allBlocks, pageEntries) {
  const pageSet = new Set(pageEntries || []);
  const out = [];
  for (const b of allBlocks || []) {
    if (b.kind !== "entry") continue;
    if (!pageSet.has(b.entry)) continue;
    if (b.isSectionStart && b.heading) {
      out.push({
        kind: "routeHeader",
        heading: b.heading,
        routeId: b.routeId || "",
        key: `hdr-page-${b.routeId || "other"}-${b.heading}`
      });
    }
    out.push(b);
  }
  return out;
}

export function normalizeRoad(road) {
  const hat = String(road.hat || "").trim();
  const company = String(road.company || EMPTY_REPORT_META.company).trim();

  let routes = extractRoadRoutes(road);
  if (!routes.length) {
    routes = [
      normalizeRoute({
        id: road.id ? `${road.id}_main` : undefined,
        roadName: "",
        kmFrom: "",
        kmTo: ""
      })
    ];
  }

  const primary = routes[0];
  const roadName = primary.roadName;
  const kmFrom = primary.kmFrom;
  const kmTo = primary.kmTo;
  const kmRange = primary.kmRange;

  const autoLabel =
    routes.length > 1 && hat
      ? `${hat} · ${routes.length} đường`
      : roadName && hat
        ? `${roadName} — ${hat}`
        : roadName || hat || "Đoạn mới";

  return {
    id: road.id || newRoadId(),
    label: String(road.label || autoLabel).trim(),
    hat,
    company,
    routes,
    // Primary — tương thích code cũ đọc 1 đường
    roadName,
    kmFrom,
    kmTo,
    kmRange,
    createdAt: road.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/** Áp danh mục từ cloud xuống local (USER không được sửa danh mục). */
export function applyRemoteRoadsCatalog(uid, remote) {
  const local = loadRoadsCatalog(uid);
  const roads = Array.isArray(remote?.roads) ? remote.roads.map(normalizeRoad) : [];
  const activeRoadId =
    local.activeRoadId && roads.some((r) => r.id === local.activeRoadId)
      ? local.activeRoadId
      : "";
  const catalog = { activeRoadId, roads };
  saveRoadsCatalog(uid, catalog);
  for (const road of roads) {
    try {
      if (hasStorage(getRoadStorageKey(uid, road.id))) {
        syncRoadMetaToStorage(uid, road);
      } else {
        ensureRoadStorage(uid, road);
      }
    } catch (err) {
      console.warn("Không tạo/ghi sổ local cho đường", road?.id, err);
    }
  }
  return catalog;
}

export function loadRoadsCatalog(uid) {
  if (!uid) return { activeRoadId: "", roads: [] };
  const backupCatalog = globalThis.__NHATKY_BACKUP_CATALOGS__?.get?.(uid);
  if (backupCatalog) {
    return {
      activeRoadId: backupCatalog.activeRoadId || "",
      roads: (backupCatalog.roads || []).map(normalizeRoad)
    };
  }
  const memoryCatalog = memoryRoadCatalogs.get(uid);
  if (memoryCatalog) {
    return {
      activeRoadId: memoryCatalog.activeRoadId || "",
      roads: (memoryCatalog.roads || []).map(normalizeRoad)
    };
  }
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
  const payload = {
    activeRoadId: catalog.activeRoadId || "",
    roads
  };
  if (String(uid).startsWith("backup_readonly_")) {
    globalThis.__NHATKY_BACKUP_CATALOGS__ ||= new Map();
    globalThis.__NHATKY_BACKUP_CATALOGS__.set(uid, payload);
    return;
  }
  try {
    localStorage.setItem(catalogKey(uid), JSON.stringify(payload));
    memoryRoadCatalogs.delete(uid);
  } catch {
    memoryRoadCatalogs.set(uid, payload);
  }
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
export function ensureRoadStorage(uid, road, routeId, routesViewMode, titleRouteIds) {
  const key = getRoadStorageKey(uid, road.id);
  if (hasStorage(key)) return key;
  const mode = routesViewMode || getRoutesViewMode(uid, road);
  const ids = titleRouteIds || getTitleRouteIds(uid, road);
  const view = withRoadTitleView(road, routeId, mode, ids) || road;
  const reportMeta = {
    ...EMPTY_REPORT_META,
    company: view.company || EMPTY_REPORT_META.company,
    hat: view.hat || "",
    roadName: view.roadName || view.label || "",
    kmRange: view.kmRange || ""
  };
  saveStorage([], {}, reportMeta, key, { silent: true, replaceAll: true });
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

export function syncRoadMetaToStorage(uid, road, routeId, routesViewMode, titleRouteIds) {
  const key = getRoadStorageKey(uid, road.id);
  if (!hasStorage(key)) return;
  const mode =
    routesViewMode ||
    road?.routesViewMode ||
    getRoutesViewMode(uid, road);
  const ids =
    titleRouteIds ||
    road?.titleRouteIds ||
    getTitleRouteIds(uid, road);
  const view =
    withRoadTitleView(road, routeId || road?.activeRouteId, mode, ids) || road;
  const current = loadStorage(key, { includeDeleted: true });
  saveStorage(
    current.entries || [],
    current.dayMeta || {},
    {
      ...current.reportMeta,
      company: view.company || current.reportMeta?.company,
      hat: view.hat || "",
      roadName: view.roadName || view.label || "",
      kmRange: view.kmRange || ""
    },
    key,
    { silent: true, replaceAll: true }
  );
}

/**
 * Meta hiển thị đầu sổ: ưu tiên danh mục tuần đường (Firebase) cho company/hat/đường/km.
 * Tránh sổ còn giữ tên công ty cũ trong reportMeta local/cloud.
 */
export function resolveReportMetaFromRoad(savedMeta, road, routeId) {
  const base = { ...EMPTY_REPORT_META, ...(savedMeta || {}) };
  if (!road) return base;
  const mode = road.routesViewMode || "split";
  const view =
    road.routesViewMode != null
      ? road
      : withRoadTitleView(road, routeId || road.activeRouteId, mode) || road;
  const company = String(view.company || "").trim();
  const hat = String(view.hat || "").trim();
  const roadName = String(view.roadName || view.label || "").trim();
  const kmRange = String(view.kmRange || "").trim();
  return {
    ...base,
    ...(company ? { company } : {}),
    ...(hat ? { hat } : {}),
    ...(roadName ? { roadName } : {}),
    ...(kmRange ? { kmRange } : {})
  };
}

export function removeRoad(uid, roadId) {
  const catalog = loadRoadsCatalog(uid);
  const roads = catalog.roads.filter((r) => r.id !== roadId);
  const activeRoadId =
    catalog.activeRoadId === roadId ? "" : catalog.activeRoadId;
  saveRoadsCatalog(uid, { roads, activeRoadId });
  localStorage.removeItem(getRoadStorageKey(uid, roadId));
}

/** Chuyển dữ liệu cũ `nhatky_{uid}` sang sổ đường đầu tiên.
 * Chỉ migrate legacy theo đúng uid — không lấy key chung `nhatky` (tránh lẫn tài khoản).
 */
export function migrateLegacyStorage(uid) {
  if (!uid) return;
  if (localStorage.getItem(catalogKey(uid))) return;

  const legacyKey = legacyStorageKey(uid);
  // Không copy global "nhatky" → tránh sổ tài khoản khác trên máy dùng chung.
  if (!localStorage.getItem(legacyKey)) {
    saveRoadsCatalog(uid, { activeRoadId: "", roads: [] });
    return;
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
  if (localStorage.getItem(legacyKey) && !hasStorage(newKey)) {
    saveStorage(
      legacy.entries || [],
      legacy.dayMeta || {},
      legacy.reportMeta || {},
      newKey,
      { silent: true, replaceAll: true }
    );
  } else if (!hasStorage(newKey)) {
    ensureRoadStorage(uid, road);
  }

  saveRoadsCatalog(uid, { roads: [road], activeRoadId: road.id });
}

export function roadDisplayLabel(road) {
  if (!road) return "";
  const routes = getRoadRoutes(road);
  const parts = [];
  if (road.hat) parts.push(road.hat);
  if (routes.length > 1) {
    parts.push(`${routes.length} đường/nhánh`);
    parts.push(routes.map((r) => r.roadName || "—").filter(Boolean).join("; "));
  } else {
    const name = routes[0]?.roadName || road.roadName || road.label;
    if (name) parts.push(name);
    const r = routes[0];
    if (r?.kmFrom || r?.kmTo) {
      const from = formatKmInput(r.kmFrom) || "…";
      const to = formatKmInput(r.kmTo) || "…";
      parts.push(`${from} → ${to}`);
    } else if (road.kmRange) {
      parts.push(road.kmRange.replace(/-/g, " → "));
    }
  }
  return parts.filter(Boolean).join(" · ");
}

/** Nhóm sổ theo tên đường chính (tương thích cũ). */
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

/** Nhóm sổ theo tuần đường (hat) — phù hợp 1 tuần đường nhiều đường. */
export function groupRoadsByHat(roads) {
  const map = new Map();
  for (const road of roads || []) {
    const key = road.hat || road.roadName || road.label || "Khác";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(road);
  }
  return [...map.entries()].map(([hat, books]) => ({
    hat,
    books: books.sort((a, b) =>
      String(a.roadName || "").localeCompare(String(b.roadName || ""), "vi")
    )
  }));
}

/**
 * Mở rộng danh sách chọn sổ theo chế độ tách/gộp của từng sổ.
 * - split + nhiều đường → mỗi đường một dòng
 * - merged → một dòng (gộp)
 */
export function expandBooksForSelect(books, options = {}) {
  const { isSplit } = options;
  const out = [];
  for (const road of books || []) {
    const routes = getRoadRoutes(road);
    const multi = routes.length > 1;
    const shouldSplit =
      multi &&
      (typeof isSplit === "function"
        ? isSplit(road)
        : defaultRoutesViewMode(road) === "split");
    if (!shouldSplit) {
      out.push({
        key: road.id,
        road,
        route: routes[0] || null,
        split: false,
        showBookActions: true
      });
      continue;
    }
    routes.forEach((route, idx) => {
      out.push({
        key: `${road.id}::${route.id}`,
        road,
        route,
        split: true,
        showBookActions: idx === 0
      });
    });
  }
  return out;
}
