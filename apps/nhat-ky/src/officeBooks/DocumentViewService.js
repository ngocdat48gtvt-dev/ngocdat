import { listActiveDates } from "../utils/demXeCompute";
import { ledgerYear } from "../utils/demXeQuarters";
import { MODULE_KEYS } from "./constants";

/**
 * Frontend — build View/Sổ từ dữ liệu Repository (read-only aggregation).
 * Không ghi storage. In / Word / PDF dùng output từ đây.
 */
export const DocumentViewService = {
  buildTrafficCount(ledger) {
    const data = ledger || { cover: {}, days: {} };
    const dates = listActiveDates(data.days || {});
    return {
      moduleKey: MODULE_KEYS.DEM_XE,
      cover: data.cover || {},
      days: data.days || {},
      activeDates: dates,
      year: ledgerYear(data.cover || {}),
      dateCount: dates.length
    };
  }
};
