import { useEffect, useMemo, useState } from "react";
import ViDateInput from "./ViDateInput";
import { fetchMasterData, getCatalogOwnerUid } from "../services/masterDataService";
import {
  createIncident,
  updateIncident
} from "../services/incidentsService";
import { uploadAndAttachPhotos } from "../services/incidentImageService";
import {
  beforeConstructionImages,
  afterConstructionImages
} from "../utils/incidentUtils";
import { displayToIso } from "../utils/dateLocale";

function toIso(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return displayToIso(s) || "";
}

const POSITIONS = [
  { code: "T", label: "Trái" },
  { code: "P", label: "Phải" },
  { code: "M", label: "Giữa" },
  { code: "TIM", label: "Tim đường" },
  { code: "TL", label: "Thượng lưu" },
  { code: "HL", label: "Hạ lưu" },
  { code: "LC", label: "Lòng cống" },
  { code: "HT", label: "Hố thu" }
];

const UNITS = ["m", "m2", "m3", "cái", "cột", "tấm"];

function unitLabel(u) {
  if (u === "m2") return "m²";
  if (u === "m3") return "m³";
  return u;
}

function emptyForm() {
  return {
    road: "",
    groupName: "",
    type: "",
    km: "",
    position: "",
    date: "",
    dai: "",
    rong: "",
    cao: "",
    unit: "m3",
    progress: 0,
    completedDate: "",
    note: ""
  };
}

function fromIncident(inc) {
  return {
    road: inc.road || "",
    groupName: inc.groupName || "",
    type: inc.type || "",
    km: inc.km || "",
    position: inc.position || "",
    date: toIso(inc.date),
    dai: inc.dai || "",
    rong: inc.rong || "",
    cao: inc.cao || "",
    unit: inc.unit || "m3",
    progress: inc.progress ?? 0,
    completedDate: toIso(inc.completedDate),
    note: inc.note || ""
  };
}

export default function IncidentFormModal({
  open,
  mode = "create",
  incident = null,
  uid,
  profile,
  extraRoads = [],
  onClose,
  onSaved
}) {
  const [form, setForm] = useState(emptyForm);
  const [master, setMaster] = useState({ roads: [], groups: [], typesByGroup: {}, unitByType: {} });
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setBeforeFiles([]);
    setAfterFiles([]);
    setForm(mode === "edit" && incident ? fromIncident(incident) : emptyForm());
  }, [open, mode, incident]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const ownerUid = getCatalogOwnerUid(profile);
    void fetchMasterData(ownerUid).then((data) => {
      if (!cancelled) setMaster(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  const roadOptions = useMemo(() => {
    const set = new Set();
    [...(master.roads || []), ...extraRoads, form.road].forEach((r) => {
      const v = String(r || "").trim();
      if (v) set.add(v);
    });
    return [...set];
  }, [master.roads, extraRoads, form.road]);

  const groupOptions = useMemo(() => {
    const set = new Set();
    [...(master.groups || []), ...Object.keys(master.typesByGroup || {}), form.groupName].forEach(
      (g) => {
        const v = String(g || "").trim();
        if (v) set.add(v);
      }
    );
    return [...set];
  }, [master.groups, master.typesByGroup, form.groupName]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    const list = master.typesByGroup?.[form.groupName] || [];
    [...list, form.type].forEach((t) => {
      const v = String(t || "").trim();
      if (v) set.add(v);
    });
    return [...set];
  }, [master.typesByGroup, form.groupName, form.type]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function onTypeChange(value) {
    const unit = master.unitByType?.[value];
    setForm((prev) => ({ ...prev, type: value, unit: unit || prev.unit }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.road.trim() || !form.type.trim() || !form.km.trim()) {
      setError("Cần nhập tối thiểu: Tuyến, Lý trình và Loại sự cố.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        createdByName: profile?.displayName || profile?.email || "",
        companyId: profile?.companyId || ""
      };
      let docId = incident?.id;
      if (mode === "edit" && docId) {
        await updateIncident(uid, docId, payload);
      } else {
        docId = await createIncident(uid, payload);
      }
      if (beforeFiles.length > 0) {
        await uploadAndAttachPhotos(uid, docId, docId, beforeFiles, "before");
      }
      if (afterFiles.length > 0) {
        await uploadAndAttachPhotos(uid, docId, docId, afterFiles, "after");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Không lưu được sự cố. Kiểm tra mạng/quyền truy cập.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const existingBefore = incident ? beforeConstructionImages(incident) : [];
  const existingAfter = incident ? afterConstructionImages(incident) : [];

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer incident-form-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incident-drawer-head">
          <h3>{mode === "edit" ? "Sửa sự cố" : "Thêm sự cố"}</h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <form className="incident-form-body" onSubmit={handleSubmit}>
          {error && <p className="nhatky-login-error">{error}</p>}

          <div className="incident-form-grid">
            <label className="incident-form-field">
              <span className="entry-form-label">Tuyến *</span>
              <input
                className="sidebar-input"
                list="incform-roads"
                value={form.road}
                onChange={(e) => setField("road", e.target.value)}
                placeholder="Chọn / nhập tuyến"
              />
              <datalist id="incform-roads">
                {roadOptions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Lý trình *</span>
              <input
                className="sidebar-input"
                value={form.km}
                onChange={(e) => setField("km", e.target.value)}
                placeholder="VD: 8+995"
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Nhóm sự cố</span>
              <select
                className="sidebar-input"
                value={form.groupName}
                onChange={(e) => setField("groupName", e.target.value)}
              >
                <option value="">— Chọn nhóm —</option>
                {groupOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Loại sự cố *</span>
              <input
                className="sidebar-input"
                list="incform-types"
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value)}
                placeholder="Chọn / nhập loại"
              />
              <datalist id="incform-types">
                {typeOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Phía</span>
              <select
                className="sidebar-input"
                value={form.position}
                onChange={(e) => setField("position", e.target.value)}
              >
                <option value="">—</option>
                {POSITIONS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Ngày xảy ra</span>
              <ViDateInput
                className="sidebar-input"
                value={form.date}
                onChange={(iso) => setField("date", iso)}
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Dài</span>
              <input
                type="number"
                step="any"
                className="sidebar-input"
                value={form.dai}
                onChange={(e) => setField("dai", e.target.value)}
              />
            </label>
            <label className="incident-form-field">
              <span className="entry-form-label">Rộng</span>
              <input
                type="number"
                step="any"
                className="sidebar-input"
                value={form.rong}
                onChange={(e) => setField("rong", e.target.value)}
              />
            </label>
            <label className="incident-form-field">
              <span className="entry-form-label">Cao</span>
              <input
                type="number"
                step="any"
                className="sidebar-input"
                value={form.cao}
                onChange={(e) => setField("cao", e.target.value)}
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Đơn vị</span>
              <select
                className="sidebar-input"
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u)}
                  </option>
                ))}
                {!UNITS.includes(form.unit) && form.unit && (
                  <option value={form.unit}>{unitLabel(form.unit)}</option>
                )}
              </select>
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Tiến độ (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                className="sidebar-input"
                value={form.progress}
                onChange={(e) => setField("progress", e.target.value)}
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Ngày hoàn thành</span>
              <ViDateInput
                className="sidebar-input"
                value={form.completedDate}
                onChange={(iso) => setField("completedDate", iso)}
              />
            </label>
          </div>

          <label className="incident-form-field incident-form-field--full">
            <span className="entry-form-label">Ghi chú</span>
            <textarea
              className="sidebar-input"
              rows={2}
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
            />
          </label>

          <div className="incident-form-photos">
            <label className="incident-form-field">
              <span className="entry-form-label">
                Ảnh hiện trạng {existingBefore.length > 0 ? `(đã có ${existingBefore.length})` : ""}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setBeforeFiles(Array.from(e.target.files || []))}
              />
            </label>
            <label className="incident-form-field">
              <span className="entry-form-label">
                Ảnh sau xử lý {existingAfter.length > 0 ? `(đã có ${existingAfter.length})` : ""}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setAfterFiles(Array.from(e.target.files || []))}
              />
            </label>
          </div>

          <div className="incident-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : mode === "edit" ? "Lưu thay đổi" : "Thêm sự cố"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
