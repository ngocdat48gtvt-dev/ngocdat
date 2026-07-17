import { fetchDemXeForRoad, pushDemXeForRoad } from "../../services/demXeService";
import {
  coverFromRoad,
  demXeScope,
  loadDemXeLedger,
  normalizeLedger,
  saveDemXeLedger,
  setDemXeLedger
} from "../../utils/demXeStore";
import { MODULE_KEYS, OFFICE_BOOK_SCHEMA_VERSION } from "../constants";

/**
 * Module dem_xe — SSOT qua demXeStore (localStorage, tương thích ngược).
 * Sau này thay implementation bằng office_books Firestore, UI không đổi.
 */
export const DemXeRepository = {
  moduleKey: MODULE_KEYS.DEM_XE,

  scope(uid, roadId) {
    return demXeScope(uid, roadId);
  },

  load(scope) {
    if (!scope) return normalizeLedger({});
    return loadDemXeLedger(scope);
  },

  save(scope, ledger) {
    if (!scope) return normalizeLedger(ledger);
    return saveDemXeLedger(scope, ledger);
  },

  replace(scope, ledger) {
    if (!scope) return normalizeLedger(ledger);
    return setDemXeLedger(scope, ledger);
  },

  coverFromRoad(activeRoad, reportMeta) {
    return coverFromRoad(activeRoad, reportMeta);
  },

  moduleMeta() {
    return {
      moduleKey: MODULE_KEYS.DEM_XE,
      schemaVersion: OFFICE_BOOK_SCHEMA_VERSION
    };
  },

  async fetchRemote(uid, roadId, roadName) {
    if (!uid || !roadId) return null;
    return fetchDemXeForRoad(uid, roadId, roadName);
  },

  async pushRemote(uid, roadId, ledger, roadName = "") {
    if (!uid || !roadId) return;
    await pushDemXeForRoad(uid, roadId, ledger, roadName);
  }
};
