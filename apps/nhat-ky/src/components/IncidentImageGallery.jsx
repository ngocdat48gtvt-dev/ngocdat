import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveDisplayImageUrl } from "../services/imageUrlService";

function useResolvedImageUrl(raw) {
  const trimmed = String(raw || "").trim();
  const httpReady = trimmed.startsWith("http");
  const [displayUrl, setDisplayUrl] = useState(httpReady ? trimmed : null);
  const [loading, setLoading] = useState(!httpReady);
  const [errorKind, setErrorKind] = useState(null);
  const refreshTried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    refreshTried.current = false;
    const next = String(raw || "").trim();
    const ready = next.startsWith("http");
    setErrorKind(null);
    if (ready) {
      setDisplayUrl(next);
      setLoading(false);
    } else {
      setDisplayUrl(null);
      setLoading(true);
    }
    void resolveDisplayImageUrl(raw).then(({ url, errorKind: kind }) => {
      if (cancelled) return;
      setDisplayUrl(url);
      setErrorKind(kind);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  const refreshOnError = useCallback(async () => {
    if (refreshTried.current) return false;
    refreshTried.current = true;
    setLoading(true);
    const { url, errorKind: kind } = await resolveDisplayImageUrl(raw, {
      forceRefresh: true
    });
    setDisplayUrl(url);
    setErrorKind(kind);
    setLoading(false);
    return !!url;
  }, [raw]);

  return { displayUrl, loading, errorKind, refreshOnError };
}

function errorMessage(errorKind) {
  if (errorKind === "local") return "Chỉ có trên app";
  if (errorKind === "auth") return "Cần đăng nhập lại";
  return "Không tải được";
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
      />
    </svg>
  );
}

function ImageThumb({ url, index, title, onOpen, selected, onToggle, mergeOrder, onOrderChange, onDelete, deleting }) {
  const { displayUrl, loading, errorKind, refreshOnError } = useResolvedImageUrl(url);
  const [error, setError] = useState(false);
  const [orderDraft, setOrderDraft] = useState(mergeOrder != null ? String(mergeOrder) : "");

  useEffect(() => {
    setError(false);
  }, [url, displayUrl]);

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
      <div className="incident-gallery-thumb-frame">
        <button
          type="button"
          className="incident-gallery-thumb"
          onClick={onOpen}
          aria-label={`${title} — ảnh ${index + 1}`}
        >
          {loading && !displayUrl ? (
            <span className="incident-gallery-thumb-loading">Đang tải…</span>
          ) : null}
          {!loading && (error || errorKind || !displayUrl) ? (
            <span className="incident-gallery-thumb-error">
              {errorMessage(errorKind)}
            </span>
          ) : null}
          {displayUrl && !error ? (
            <img
              src={displayUrl}
              alt={`${title} ${index + 1}`}
              loading="lazy"
              onError={() => {
                void refreshOnError().then((ok) => {
                  if (!ok) setError(true);
                });
              }}
            />
          ) : null}
        </button>

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

        {selected && mergeOrder != null ? (
          <span className="incident-gallery-order-badge" aria-hidden="true">
            {mergeOrder}
          </span>
        ) : null}

        {(onDelete || onOpen) && (
          <div className="incident-gallery-thumb-bar">
            {onOpen ? (
              <button
                type="button"
                className="incident-gallery-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                aria-label="Xem ảnh"
                title="Xem ảnh"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="incident-gallery-action-btn incident-gallery-action-btn--danger"
                disabled={deleting}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label={`Xóa ${title} — ảnh ${index + 1}`}
                title="Xóa ảnh"
              >
                {deleting ? "…" : <TrashIcon />}
              </button>
            ) : null}
          </div>
        )}

        <span className="incident-gallery-thumb-label">Ảnh {index + 1}</span>
      </div>
      {selected && onOrderChange ? (
        <div className="incident-gallery-order-row" onClick={(e) => e.stopPropagation()}>
            <label className="incident-gallery-order-label" htmlFor={`stt-${url.slice(-12)}-${index}`}>
            Thứ tự Word
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
  const rawUrl = urls[index];
  const { displayUrl, loading, errorKind, refreshOnError } = useResolvedImageUrl(rawUrl);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [rawUrl, displayUrl]);

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

  const showError = !loading && (imgError || errorKind || !displayUrl);

  return createPortal(
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
        {displayUrl && !imgError ? (
          <img
            key={displayUrl}
            src={displayUrl}
            alt=""
            className="incident-lightbox-img"
            onError={() => {
              void refreshOnError().then((ok) => {
                if (!ok) setImgError(true);
              });
            }}
          />
        ) : null}
        {loading ? <p className="incident-lightbox-status">Đang tải…</p> : null}
        {showError ? (
          <p className="incident-lightbox-status">{errorMessage(errorKind)}</p>
        ) : null}
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
        <a href={displayUrl || rawUrl} target="_blank" rel="noreferrer">
          Mở ảnh gốc
        </a>
      </div>
    </div>,
    document.body
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
          <span className="incident-gallery-count">({urls.length})</span>
          {urls.length > 0 ? (
            <span className="incident-gallery-selected-count">
              · Đã chọn {selected.length}/{urls.length}
            </span>
          ) : null}
        </p>
        {onSelectAll && urls.length > 0 ? (
          <div className="incident-gallery-actions">
            <button
              type="button"
              className="incident-gallery-select-all"
              onClick={onSelectAll}
              disabled={allSelected}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              className="incident-gallery-select-all incident-gallery-select-all--clear"
              onClick={onClearAll}
              disabled={selected.length === 0}
            >
              Bỏ chọn
            </button>
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
  deletingUrl,
  wordBarTitle = "Ảnh dùng trong báo cáo Word",
  wordBarHint = "Chọn ảnh và sắp xếp thứ tự xuất báo cáo.",
  selectedSummary
}) {
  const [lightbox, setLightbox] = useState(null);

  function openSection(title, urls, index) {
    setLightbox({ title, urls, index });
  }

  const hasAnyPhoto = beforeUrls.length > 0 || afterUrls.length > 0;
  const selectedCount =
    (selection?.beforeUrls?.length || 0) + (selection?.afterUrls?.length || 0);
  const totalCount = beforeUrls.length + afterUrls.length;
  const allPhotosSelected = totalCount > 0 && selectedCount >= totalCount;
  const summaryText =
    selectedSummary ||
    (totalCount > 0
      ? `Đã chọn ${selectedCount}/${totalCount} ảnh`
      : "Chưa có ảnh");

  return (
    <>
      <div className="incident-gallery">
        {selection ? (
          <div className="incident-gallery-global-actions">
            <div className="incident-gallery-global-text">
              <span className="incident-gallery-global-label">{wordBarTitle}</span>
              <span className="incident-gallery-selected-count">{summaryText}</span>
              {wordBarHint ? (
                <span className="incident-gallery-global-hint" title={wordBarHint}>
                  {wordBarHint}
                </span>
              ) : null}
            </div>
            {hasAnyPhoto ? (
              <div className="incident-gallery-actions">
                <button
                  type="button"
                  className="incident-gallery-select-all"
                  disabled={allPhotosSelected}
                  onClick={() => {
                    if (selection.onSelectAllPhotos) selection.onSelectAllPhotos();
                    else {
                      selection.onSelectAll("before");
                      selection.onSelectAll("after");
                    }
                  }}
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="incident-gallery-select-all incident-gallery-select-all--clear"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    if (selection.onClearAllPhotos) selection.onClearAllPhotos();
                    else {
                      selection.onClearAll("before");
                      selection.onClearAll("after");
                    }
                  }}
                >
                  Bỏ chọn
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
