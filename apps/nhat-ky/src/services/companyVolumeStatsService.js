import { fetchCompanyOfficeUsers } from "./officeBrowseService";
import { fetchOfficeRoadsCatalog } from "./officeRoadsCatalogService";
import { fetchOfficeBookAsStorage } from "./officeBooksService";

function looksLikeRawRoadId(value) {
  return /^road_[a-z0-9_]+$/i.test(String(value || "").trim());
}

/** Tên đường: ưu tiên danh mục ADMIN gán — không lấy id thô / meta lệch. */
function resolveRoadDisplayName(road, reportMeta, roadId) {
  const fromCatalog = String(road?.roadName || road?.label || "").trim();
  if (fromCatalog && !looksLikeRawRoadId(fromCatalog)) return fromCatalog;

  const fromMeta = String(reportMeta?.roadName || reportMeta?.road || "").trim();
  if (fromMeta && !looksLikeRawRoadId(fromMeta)) return fromMeta;

  const hat = String(road?.hat || reportMeta?.hat || "").trim();
  const km = String(road?.kmRange || reportMeta?.kmRange || "").trim();
  if (hat && km) return `Hạt ${hat} (${km})`;
  if (hat) return `Hạt ${hat}`;
  if (km) return km;
  if (looksLikeRawRoadId(roadId)) return "Sổ chưa đặt tên";
  return String(roadId || "Sổ chưa đặt tên");
}

/**
 * Tải KL theo danh mục sổ ADMIN đã gán cho từng USER.
 * Không gộp office_books lạc (đã xóa khỏi danh mục) — tránh đường lạ lẫn user.
 */
export async function fetchCompanyVolumeSources(companyId) {
  if (!companyId) {
    return { sources: [], users: [], error: "Thiếu companyId." };
  }

  const users = await fetchCompanyOfficeUsers(companyId);
  const sources = [];

  for (const user of users) {
    const catalog = await fetchOfficeRoadsCatalog(user.uid);
    const catalogRoads = (catalog.roads || []).filter((r) => r?.id);

    await Promise.all(
      catalogRoads.map(async (road) => {
        const roadId = road.id;
        const storage = await fetchOfficeBookAsStorage(user.uid, roadId);
        const meta = storage.reportMeta || {};

        sources.push({
          uid: user.uid,
          userName: user.displayName || user.uid,
          roadId,
          roadName: resolveRoadDisplayName(road, meta, roadId),
          hat: String(road.hat || "").trim() || String(meta.hat || "").trim(),
          kmRange: String(road.kmRange || "").trim() || String(meta.kmRange || "").trim(),
          entries: storage.entries || [],
          contractVolumes: Array.isArray(meta.contractVolumes) ? meta.contractVolumes : []
        });
      })
    );
  }

  return { sources, users };
}
