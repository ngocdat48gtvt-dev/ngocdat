import { useEffect, useState } from "react";

function ImageThumb({ url, index, title, onOpen, selected, onToggle, mergeOrder, onOrderChange, onDelete, deleting }) {
  const [error, setError] = useState(false);
  const [orderDraft, setOrderDraft] = useState(mergeOrder != null ? String(mergeOrder) : "");

  useEffect(() => {
    setOrderDraft(mergeOrder != null ? String(mergeOrder) : "");
  }, [mergeOrder]);

  function commitOrder() {
    if (!onOrderChange) return;
    const n = parseInt(orderDraft, 10);
    if (!Number.isFinite(n) || n < 1) {
      setOrderDraft(mergeOrder != null ? String(mergeOrder) : "1");
      return;
    }
    onOrderChange(n);
  }

  return (
    <div
      className={`incident-gallery-thumb-wrap${selected ? " incident-gallery-thumb-wrap--selected" : ""}`}
    >
      {onToggle ? (
        <button
          type="button"
          className={`incident-gallery-select${selected ? " incident-gallery-select--on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={selected ? "Bỏ chọn ảnh Word" : "Chọn ảnh Word"}
          aria-pressed={selected}
        >
          {selected ? "✓" : ""}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="incident-gallery-delete"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Xóa ${title} — ảnh ${index + 1}`}
          title="Xóa ảnh"
        >
          {deleting ? "…" : "×"}
        </button>
      ) : null}
      {selected && mergeOrder != null ? (
        <span className="incident-gallery-order-badge" aria-hidden="true">
          {mergeOrder}
        </span>
      ) : null}
      <button
        type="button"
        className="incident-gallery-thumb"
        onClick={onOpen}
        aria-label={`${title} — ảnh ${index + 1}`}
      >
        <div className="incident-gallery-thumb-frame">
          {error ? (
            <span className="incident-gallery-thumb-error">Không tải được</span>
          ) : (
            <img
              src={url}
              alt={`${title} ${index + 1}`}
              loading="lazy"
              onError={() => setError(true)}
            />
          )}
          <span className="incident-gallery-thumb-label">Ảnh {index + 1}</span>
        </div>
      </button>
      {selected && onOrderChange ? (
        <div className="incident-gallery-order-row" onClick={(e) => e.stopPropagation()}>
          <label className="incident-gallery-order-label" htmlFor={`stt-${url.slice(-12)}-${index}`}>
            STT
          </label>
          <input
            id={`stt-${url.slice(-12)}-${index}`}
            type="number"
            min={1}
            inputMode="numeric"
            className="incident-gallery-order-input"
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            onBlur={commitOrder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitOrder();
                e.target.blur();
              }
            }}
            aria-label="Số thứ tự ghép Word"
          />
        </div>
      ) : null}
    </div>
  );
}

function ImageLightbox({ state, onClose, onIndexChange }) {
  const { urls, index, title } = state;
  const url = urls[index];

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        onIndexChange((index - 1 + urls.length) % urls.length);
      }
      if (e.key === "ArrowRight") {
        onIndexChange((index + 1) % urls.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndexChange, urls.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="incident-lightbox" role="dialog" aria-modal="true" aria-label={`Xem ảnh — ${title}`}>
      <div className="incident-lightbox-head">
        <p>
          {title} · {index + 1}/{urls.length}
        </p>
        <button type="button" className="incident-lightbox-close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>
      <div className="incident-lightbox-body">
        {urls.length > 1 && (
          <button
            type="button"
            className="incident-lightbox-nav incident-lightbox-nav--prev"
            onClick={() => onIndexChange((index - 1 + urls.length) % urls.length)}
            aria-label="Ảnh trước"
          >
            ‹
          </button>
        )}
        <img src={url} alt="" className="incident-lightbox-img" />
        {urls.length > 1 && (
          <button
            type="button"
            className="incident-lightbox-nav incident-lightbox-nav--next"
            onClick={() => onIndexChange((index + 1) % urls.length)}
            aria-label="Ảnh sau"
          >
            ›
          </button>
        )}
      </div>
      <div className="incident-lightbox-foot">
        <a href={url} target="_blank" rel="noreferrer">
          Mở ảnh gốc
        </a>
      </div>
    </div>
  );
}

function ImageSection({
  title,
  urls,
  onOpen,
  selectedUrls,
  onToggle,
  onSelectAll,
  onClearAll,
  orderIndex,
  onOrderChange,
  onDeletePhoto,
  deletingUrl
}) {
  const selected = selectedUrls ?? [];
  const allSelected = urls.length > 0 && urls.every((u) => selected.includes(u));

  return (
    <div className="incident-gallery-section">
      <div className="incident-gallery-head">
        <p className="incident-gallery-title">
          {title}
          {urls.length > 0 && <span className="incident-gallery-count">({urls.length})</span>}
        </p>
        {onSelectAll && urls.length > 0 ? (
          <div className="incident-gallery-actions">
            <button
              type="button"
              className="incident-gallery-select-all"
              onClick={allSelected ? onClearAll : onSelectAll}
            >
              {allSelected ? "Bỏ chọn tất" : "Chọn tất"}
            </button>
            {selected.length > 0 ? (
              <span className="incident-gallery-selected-count">
                Đã chọn {selected.length}/{urls.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {urls.length === 0 ? (
        <p className="incident-gallery-empty">Chưa có ảnh</p>
      ) : (
        <div className="incident-gallery-row">
          {urls.map((url, index) => (
            <ImageThumb
              key={url}
              url={url}
              index={index}
              title={title}
              onOpen={() => onOpen(index)}
              selected={selected.includes(url)}
              onToggle={onToggle ? () => onToggle(url) : undefined}
              mergeOrder={orderIndex?.(url)}
              onOrderChange={
                onOrderChange && selected.includes(url)
                  ? (order) => onOrderChange(url, order)
                  : undefined
              }
              onDelete={onDeletePhoto ? () => onDeletePhoto(url) : undefined}
              deleting={deletingUrl === url}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncidentImageGallery({
  beforeUrls = [],
  afterUrls = [],
  beforeTitle = "Hiện trạng",
  afterTitle = "Sau xử lý",
  selection,
  onDeletePhoto,
  deletingUrl
}) {
  const [lightbox, setLightbox] = useState(null);

  function openSection(title, urls, index) {
    setLightbox({ title, urls, index });
  }

  return (
    <>
      <div className="incident-gallery">
        <ImageSection
          title={beforeTitle}
          urls={beforeUrls}
          onOpen={(index) => openSection(beforeTitle, beforeUrls, index)}
          selectedUrls={selection?.beforeUrls}
          onToggle={selection ? (url) => selection.onToggle("before", url) : undefined}
          onSelectAll={selection ? () => selection.onSelectAll("before") : undefined}
          onClearAll={selection ? () => selection.onClearAll("before") : undefined}
          orderIndex={selection?.orderIndex ? (url) => selection.orderIndex("before", url) : undefined}
          onOrderChange={
            selection?.onOrderChange
              ? (url, order) => selection.onOrderChange("before", url, order)
              : undefined
          }
          onDeletePhoto={onDeletePhoto ? (url) => onDeletePhoto("before", url) : undefined}
          deletingUrl={deletingUrl}
        />
        <ImageSection
          title={afterTitle}
          urls={afterUrls}
          onOpen={(index) => openSection(afterTitle, afterUrls, index)}
          selectedUrls={selection?.afterUrls}
          onToggle={selection ? (url) => selection.onToggle("after", url) : undefined}
          onSelectAll={selection ? () => selection.onSelectAll("after") : undefined}
          onClearAll={selection ? () => selection.onClearAll("after") : undefined}
          orderIndex={selection?.orderIndex ? (url) => selection.orderIndex("after", url) : undefined}
          onOrderChange={
            selection?.onOrderChange
              ? (url, order) => selection.onOrderChange("after", url, order)
              : undefined
          }
          onDeletePhoto={onDeletePhoto ? (url) => onDeletePhoto("after", url) : undefined}
          deletingUrl={deletingUrl}
        />
      </div>
      {lightbox && (
        <ImageLightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
        />
      )}
    </>
  );
}
