/**
 * Chuyển lý trình dạng Km12+300 → 12300 để sắp xếp đúng thứ tự trên tuyến.
 */
export function parseKmToSortValue(km) {
  if (!km?.trim()) return Number.MAX_SAFE_INTEGER;

  const clean = km.replace(/Km/gi, "").replace(/\s/g, "").trim();

  if (clean.includes("+")) {
    const [kmPart, mPart] = clean.split("+", 2);
    const kmNum = parseInt(kmPart, 10) || 0;
    const mNum = Math.min(999, Math.max(0, parseInt(mPart, 10) || 0));
    return kmNum * 1000 + mNum;
  }

  const digits = clean.replace(/\D/g, "");
  if (!digits) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(digits, 10);
  if (n >= 1000) {
    return Math.floor(n / 1000) * 1000 + (n % 1000);
  }
  return n * 1000;
}

export function formatKmDisplay(km) {
  const raw = (km ?? "").trim();
  if (!raw) return "";
  const clean = raw.replace(/Km/gi, "").replace(/\s/g, "");

  let kmNum;
  let mNum;
  if (clean.includes("+")) {
    const [kmPart, mPart] = clean.split("+", 2);
    kmNum = parseInt(kmPart.replace(/\D/g, ""), 10) || 0;
    mNum = parseInt((mPart ?? "").replace(/\D/g, ""), 10) || 0;
  } else {
    const digits = clean.replace(/\D/g, "");
    if (!digits) return raw;
    const n = parseInt(digits, 10);
    if (n >= 1000) {
      kmNum = Math.floor(n / 1000);
      mNum = n % 1000;
    } else {
      kmNum = n;
      mNum = 0;
    }
  }
  mNum = Math.min(999, Math.max(0, mNum));
  return `Km${kmNum}+${String(mNum).padStart(3, "0")}`;
}

export function compareByKm(a, b) {
  return parseKmToSortValue(a) - parseKmToSortValue(b);
}

export function sortIncidentsByKm(items) {
  return [...items].sort((a, b) => {
    const roadCmp = (a.road ?? "").localeCompare(b.road ?? "", "vi");
    if (roadCmp !== 0) return roadCmp;
    return compareByKm(a.km, b.km);
  });
}

export function chainageDedupeKey(inc) {
  const kmVal = parseKmToSortValue(inc.km);
  if (kmVal === Number.MAX_SAFE_INTEGER) return null;
  const road = (inc.road ?? "").trim() || "—";
  return `${road}\0${kmVal}`;
}

export function buildDuplicateChainageKeySet(items) {
  const counts = new Map();
  for (const inc of items) {
    const key = chainageDedupeKey(inc);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set();
  for (const [key, count] of counts) {
    if (count > 1) dupes.add(key);
  }
  return dupes;
}

export function matchesChainageSearch(km, query) {
  const q = query.trim();
  if (!q) return true;

  const kmStr = (km ?? "").trim();
  if (!kmStr) return false;

  const qLower = q.toLowerCase();
  if (kmStr.toLowerCase().includes(qLower)) return true;

  const qNorm = q.replace(/km/gi, "").replace(/\s/g, "").toLowerCase();
  const kmNorm = kmStr.replace(/km/gi, "").replace(/\s/g, "").toLowerCase();
  if (qNorm && kmNorm.includes(qNorm)) return true;

  const qVal = parseKmToSortValue(q);
  const kmVal = parseKmToSortValue(km);
  if (qVal !== Number.MAX_SAFE_INTEGER && kmVal !== Number.MAX_SAFE_INTEGER) {
    return kmVal === qVal;
  }

  return false;
}
