import { useEffect, useMemo, useState } from "react";
import ViDateInput from "./ViDateInput";
import { fetchMasterData, getCatalogOwnerUid } from "../services/masterDataService";
import {
  createIncident,
  updateIncident
} from "../services/incidentsService";
import { uploadAndAttachPhotos } from "../services/incidentImageService";
import { resolveDisplayImageUrl } from "../services/imageUrlService";
import {
  beforeConstructionImages,
  afterConstructionImages,
  webDisplayImageUrls
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

function ExistingThumb({ url }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let cancelled = false;
    void resolveDisplayImageUrl(url).then(({ url: resolved }) => {
      if (!cancelled) setSrc(resolved || null);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!src) {
    return <span className="incident-form-thumb incident-form-thumb--empty">…</span>;
  }
  return <img className="incident-form-thumb" src={src} alt="" />;
}

function LocalThumb({ file }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!src) return null;
  return <img className="incident-form-thumb" src={src} alt={file.name} />;
}

function PhotoBlock({ title, count, existingUrls, files, onFilesChange, inputId }) {
  return (
    <div className="incident-form-photo-block">
      <p className="incident-form-photo-title">
        {title}
        {count > 0 ? ` (${count})` : ""}
      </p>
      <div className="incident-form-thumbs">
        {existingUrls.map((url) => (
          <ExistingThumb key={url} url={url} />
        ))}
        {files.map((file, i) => (
          <LocalThumb key={`${file.name}-${file.size}-${i}`} file={file} />
        ))}
        {existingUrls.length === 0 && files.length === 0 ? (
          <span className="incident-form-photo-empty">Chưa có ảnh</span>
        ) : null}
      </div>
      <label className="incident-form-photo-add" htmlFor={inputId}>
        <span>+ Thêm ảnh {title.toLowerCase()}</span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
        />
      </label>
      {files.length > 0 ? (
        <p className="incident-form-photo-pending">Sẽ thêm {files.length} ảnh mới khi lưu</p>
      ) : null}
    </div>
  );
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

  const existingBefore = incident
    ? webDisplayImageUrls(beforeConstructionImages(incident))
    : [];
  const existingAfter = incident
    ? webDisplayImageUrls(afterConstructionImages(incident))
    : [];

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer incident-form-modal incident-form-modal--wide"
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
                placeholder="VD: Km8+995"
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Nhóm sự cố</span>
              <select
                className="sidebar-input"
                value={form.groupName}
                onChange={(e) => setField("groupName", e.target.value)}
              >
                <option value="">Chọn nhóm…</option>
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
                hideCalendarButton
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Ngày hoàn thành</span>
              <ViDateInput
                className="sidebar-input"
                value={form.completedDate}
                onChange={(iso) => setField("completedDate", iso)}
                hideCalendarButton
              />
            </label>

            <label className="incident-form-field">
              <span className="entry-form-label">Tiến độ (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                className="sidebar-input"
                value={form.progress}
                onChange={(e) => {
                  const p = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setForm((prev) => {
                    let completedDate = prev.completedDate;
                    if (p >= 90 && !String(completedDate || "").trim()) {
                      completedDate = new Date().toISOString().slice(0, 10);
                    }
                    return { ...prev, progress: p, completedDate };
                  });
                }}
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

            <label className="incident-form-field incident-form-field--full">
              <span className="entry-form-label">Ghi chú</span>
              <textarea
                className="sidebar-input"
                rows={3}
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
                placeholder="Ghi chú (nếu có)"
              />
            </label>
          </div>

          <div className="incident-form-photos">
            <PhotoBlock
              title="Ảnh hiện trạng"
              count={existingBefore.length}
              existingUrls={existingBefore}
              files={beforeFiles}
              onFilesChange={setBeforeFiles}
              inputId="incform-before-files"
            />
            <PhotoBlock
              title="Ảnh sau xử lý"
              count={existingAfter.length}
              existingUrls={existingAfter}
              files={afterFiles}
              onFilesChange={setAfterFiles}
              inputId="incform-after-files"
            />
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
