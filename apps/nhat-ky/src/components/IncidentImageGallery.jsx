import { useEffect, useState } from "react";

function ImageThumb({ url, index, title, onOpen }) {
  const [error, setError] = useState(false);

  return (
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

function ImageSection({ title, urls, onOpen }) {
  return (
    <div className="incident-gallery-section">
      <p className="incident-gallery-title">
        {title}
        {urls.length > 0 && <span className="incident-gallery-count">({urls.length})</span>}
      </p>
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
  beforeTitle = "Trước thi công",
  afterTitle = "Sau thi công"
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
        />
        <ImageSection
          title={afterTitle}
          urls={afterUrls}
          onOpen={(index) => openSection(afterTitle, afterUrls, index)}
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
