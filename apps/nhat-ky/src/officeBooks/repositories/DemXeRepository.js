import { fetchDemXeForRoad, pushDemXeForRoad } from "../../services/demXeService";
import {
  coverFromRoad,
  demXeScope,
  loadDemXeLedger,
  normalizeLedger,
  resolveDemXeScope,
  saveDemXeLedger,
  setDemXeLedger,
  writeDemXeScope
} from "../../utils/demXeStore";
import { MODULE_KEYS, OFFICE_BOOK_SCHEMA_VERSION } from "../constants";

/**
 * Module dem_xe — SSOT qua demXeStore (localStorage, tương thích ngược).
 * Nhiều nhánh: scope local + byRoute trên cloud theo routeId.
 */
export const DemXeRepository = {
  moduleKey: MODULE_KEYS.DEM_XE,

  scope(uid, roadId, routeId = "") {
    return demXeScope(uid, roadId, routeId);
  },

  resolveScope(uid, roadId, routeId, routes = []) {
    return resolveDemXeScope(uid, roadId, routeId, routes);
  },

  writeScope(uid, roadId, routeId, routes = []) {
    return writeDemXeScope(uid, roadId, routeId, routes);
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

  async fetchRemote(uid, roadId, roadName, opts = {}) {
    if (!uid || !roadId) return null;
    return fetchDemXeForRoad(uid, roadId, roadName, opts);
  },

  async pushRemote(uid, roadId, ledger, roadName = "", opts = {}) {
    if (!uid || !roadId) return;
    await pushDemXeForRoad(uid, roadId, ledger, roadName, opts);
  }
};
