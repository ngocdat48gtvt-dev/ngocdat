import { formatKmCell } from "../utils/matDuongFormat";
import {
  CONG_OP_STATUS,
  congOpStatusLabel,
  formatCongHeaderSpecs,
  summarizeCongCurrentStatus
} from "../utils/congDiaryStatus";

function formatKm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return formatKmCell(v) || v;
}

/**
 * Cửa sổ chi tiết trạng thái + lịch sử sổ tuần đường của một cống.
 */
export default function CongStatusDrawer({
  cong,
  status,
  history = [],
  roadLabel = "",
  onClose
}) {
  if (!cong) return null;

  const kmLabel = formatKm(cong.km) || String(cong.km || "").trim() || "—";
  const condition = String(cong.condition || "").trim();
  const specs = formatCongHeaderSpecs(cong, roadLabel);
  const summary = summarizeCongCurrentStatus(status, history, cong);
  const statusLabel = congOpStatusLabel(status);
  const latest = history[0] || null;
  const showFacts =
    summary.dateLabel || summary.detail || summary.quantityLabel || latest;

  return (
    <div className="cong-status-overlay" role="presentation" onClick={onClose}>
      <div
        className="cong-status-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cong-status-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cong-status-head">
          <div className="cong-status-head-main">
            <h3 id="cong-status-title">
              CỐNG {kmLabel}
              {condition ? (
                <span className="cong-status-condition-pill">[{condition}]</span>
              ) : (
                <span
                  className={`cong-status-condition-pill cong-status-condition-pill--op cong-op--${status}`}
                >
                  [{statusLabel}]
                </span>
              )}
            </h3>
            {specs ? <p className="cong-status-specs">{specs}</p> : null}
          </div>
          <button
            type="button"
            className="cong-status-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        <div className="cong-status-body">
          <section className="cong-status-block">
            <h4 className="cong-status-block-title">Tình trạng hiện tại</h4>
            <div className={`cong-status-current cong-op--${status}`}>
              <span className="cong-status-current-icon" aria-hidden="true">
                {summary.icon === "warn" ? "⚠" : summary.icon === "new" ? "＋" : "✓"}
              </span>
              <div className="cong-status-current-body">
                <p className="cong-status-current-badge">{statusLabel}</p>
                {showFacts ? (
                  <dl className="cong-status-hist-fields cong-status-hist-fields--current">
                    <div className="cong-status-hist-row">
                      <dt>Ngày</dt>
                      <dd>{summary.dateLabel || latest?.dateLabel || "—"}</dd>
                    </div>
                    <div className="cong-status-hist-row">
                      <dt>Chi tiết</dt>
                      <dd>{summary.detail || latest?.detail || latest?.type || "—"}</dd>
                    </div>
                    <div className="cong-status-hist-row">
                      <dt>Khối lượng</dt>
                      <dd>
                        {summary.quantityLabel || latest?.quantityLabel || "—"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="cong-status-current-text">{summary.text}</p>
                )}
              </div>
            </div>
          </section>

          <section className="cong-status-block">
            <h4 className="cong-status-block-title">Lịch sử (sổ tuần đường)</h4>
            {history.length === 0 ? (
              <p className="cong-status-empty">
                Chưa có dòng nào chọn <strong>Xuất DS cống</strong> gắn cống này trên sổ tuần
                đường. Công việc thường (không chọn xuất) không vào lịch sử.
              </p>
            ) : (
              <ul className="cong-status-history">
                {history.map((item) => (
                  <li
                    key={item.entryKey}
                    className={`cong-status-hist-item cong-status-hist-item--${item.kind}`}
                  >
                    <div
                      className={`cong-status-hist-tag${
                        item.kind === "resolved"
                          ? " is-ok"
                          : item.kind === "new"
                            ? " is-new"
                            : " is-warn"
                      }`}
                    >
                      {item.kind === "resolved"
                        ? "✓ SỬA CHỮA"
                        : item.kind === "new"
                          ? "＋ BỔ SUNG"
                          : "⚠ HƯ HỎNG"}
                    </div>
                    <dl className="cong-status-hist-fields">
                      <div className="cong-status-hist-row">
                        <dt>Ngày kiểm tra</dt>
                        <dd>{item.dateLabel || "—"}</dd>
                      </div>
                      <div className="cong-status-hist-row">
                        <dt>Lý trình</dt>
                        <dd>
                          {item.lyTrinh
                            ? formatKm(item.lyTrinh) || item.lyTrinh
                            : kmLabel}
                        </dd>
                      </div>
                      <div className="cong-status-hist-row">
                        <dt>Chi tiết</dt>
                        <dd>{item.detail || item.type || "—"}</dd>
                      </div>
                      <div className="cong-status-hist-row">
                        <dt>Khối lượng</dt>
                        <dd>{item.quantityLabel || "—"}</dd>
                      </div>
                      {item.plannedRepairDateLabel ? (
                        <div className="cong-status-hist-row">
                          <dt>Dự kiến sửa (BDTX)</dt>
                          <dd>{item.plannedRepairDateLabel}</dd>
                        </div>
                      ) : null}
                      {item.maintenance ? (
                        <div className="cong-status-hist-row">
                          <dt>Công việc BDTX</dt>
                          <dd>{item.maintenance}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="cong-status-hist-link">
                      → Trong sổ tuần đường ngày {item.dateLabel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {status === CONG_OP_STATUS.BINH_THUONG && history.length === 0 ? (
            <p className="cong-status-footnote">
              Khi tuần đường chọn <strong>Xuất DS cống</strong> (Hư hỏng / Sửa chữa / Bổ sung),
              trạng thái và lịch sử sẽ cập nhật tại đây.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
