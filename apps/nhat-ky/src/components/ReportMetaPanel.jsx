export default function ReportMetaPanel({ reportMeta, onChange }) {
  function setField(field, value) {
    onChange({ ...reportMeta, [field]: value });
  }

  return (
    <div className="report-meta-form">
      <label className="report-meta-field">
        <span>Tên công ty</span>
        <input
          className="sidebar-input"
          value={reportMeta.company}
          onChange={(e) => setField("company", e.target.value)}
        />
      </label>
      <label className="report-meta-field">
        <span>Tên Hạt</span>
        <input
          className="sidebar-input"
          value={reportMeta.hat}
          onChange={(e) => setField("hat", e.target.value)}
        />
      </label>
      <label className="report-meta-field">
        <span>Tên đường</span>
        <input
          className="sidebar-input"
          value={reportMeta.roadName}
          onChange={(e) => setField("roadName", e.target.value)}
        />
      </label>
      <label className="report-meta-field">
        <span>Lý trình</span>
        <input
          className="sidebar-input"
          placeholder="Km356+700-Km404+000"
          value={reportMeta.kmRange}
          onChange={(e) => setField("kmRange", e.target.value)}
        />
      </label>
    </div>
  );
}
