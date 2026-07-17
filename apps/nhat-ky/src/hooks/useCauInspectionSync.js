import { useCallback, useEffect, useRef } from "react";
import {
  fetchCauInspections,
  pushCauInspections,
  cauInspectionSheetId
} from "../services/cauInspectionService";
import {
  CAU_INSPECTION_EVENT,
  loadCauInspectionSheet,
  saveCauInspectionSheet
} from "../utils/cauInspectionStore";

const PUSH_DEBOUNCE_MS = 1800;
const PREFIX = "cau-inspection-v2-";

function listLocalSheetIds(uid, roadId) {
  if (!uid || !roadId || typeof localStorage === "undefined") return [];
  const needle = `${PREFIX}${uid}__${roadId}__`;
  const out = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(needle)) continue;
    const rest = key.slice(needle.length);
    const sep = rest.lastIndexOf("__");
    if (sep <= 0) continue;
    const bridgeId = rest.slice(0, sep);
    const yearMonth = rest.slice(sep + 2);
    if (bridgeId && /^\d{4}-\d{2}$/.test(yearMonth)) {
      out.push({ bridgeId, yearMonth, id: cauInspectionSheetId(bridgeId, yearMonth) });
    }
  }
  return out;
}

function collectLocalSheets(uid, roadId) {
  const map = {};
  listLocalSheetIds(uid, roadId).forEach(({ bridgeId, yearMonth, id }) => {
    map[id] = loadCauInspectionSheet(uid, roadId, bridgeId, yearMonth);
  });
  return map;
}

function applyRemoteSheets(uid, roadId, remoteSheets) {
  Object.entries(remoteSheets || {}).forEach(([id, sheet]) => {
    const sep = id.lastIndexOf("__");
    if (sep <= 0) return;
    const bridgeId = id.slice(0, sep);
    const yearMonth = id.slice(sep + 2);
    if (!bridgeId || !/^\d{4}-\d{2}$/.test(yearMonth)) return;
    // Ghi local không phát event để tránh vòng push
    const key = `${PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
    try {
      localStorage.setItem(key, JSON.stringify(sheet));
    } catch {
      /* ignore */
    }
  });
}

/**
 * Hydrate/push phiếu KT cầu theo office_books/{roadId}/modules/cau_inspections.
 * Logic local vẫn theo hạt (roadId) + cầu + tháng (ngày trong tờ).
 */
export function useCauInspectionSync({
  uid,
  roadId,
  enabled = true,
  canPush = false,
  browseMode = false,
  onHydrated
}) {
  const pushTimer = useRef(null);
  const hydratingRef = useRef(false);
  const onHydratedRef = useRef(onHydrated);
  onHydratedRef.current = onHydrated;

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId) return;
    const sheets = collectLocalSheets(uid, roadId);
    if (!Object.keys(sheets).length) return;
    await pushCauInspections(uid, roadId, sheets);
  }, [canPush, uid, roadId]);

  const schedulePush = useCallback(() => {
    if (!canPush || hydratingRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      flushPush().catch((err) => {
        console.warn("Đồng bộ phiếu KT cầu lên cloud thất bại.", err);
      });
    }, PUSH_DEBOUNCE_MS);
  }, [canPush, flushPush]);

  useEffect(() => {
    if (!enabled || !uid || !roadId) return undefined;

    let cancelled = false;

    async function hydrate() {
      hydratingRef.current = true;
      try {
        const remote = await fetchCauInspections(uid, roadId);
        if (cancelled) return;
        const remoteCount = Object.keys(remote).length;
        const local = collectLocalSheets(uid, roadId);
        const localCount = Object.keys(local).length;

        if (remoteCount) {
          // Browse: luôn lấy cloud của user; USER: merge giữ local mới hơn
          const merged = browseMode ? { ...remote } : { ...remote, ...local };
          applyRemoteSheets(uid, roadId, merged);
          if (canPush && !browseMode) await pushCauInspections(uid, roadId, merged);
          onHydratedRef.current?.();
        } else if (localCount && canPush) {
          await pushCauInspections(uid, roadId, local);
        }
      } catch (err) {
        console.warn("Không hydrate được phiếu KT cầu.", err);
      } finally {
        hydratingRef.current = false;
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [enabled, uid, roadId, canPush, browseMode]);

  useEffect(() => {
    if (!enabled || !uid || !roadId) return undefined;
    function onLocalChange() {
      schedulePush();
    }
    window.addEventListener(CAU_INSPECTION_EVENT, onLocalChange);
    return () => window.removeEventListener(CAU_INSPECTION_EVENT, onLocalChange);
  }, [enabled, uid, roadId, schedulePush]);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return { flushPush };
}

/** Ghi đè local từ 1 sheet đã normalize (dùng khi hydrate từng tờ). */
export function writeCauInspectionLocalSilent(uid, roadId, bridgeId, yearMonth, sheet) {
  if (!uid || !roadId || !bridgeId || !yearMonth) return;
  const key = `${PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
  localStorage.setItem(key, JSON.stringify(sheet));
}

// Giữ save có event cho UI — hydrate silent dùng write ở trên
void saveCauInspectionSheet;
