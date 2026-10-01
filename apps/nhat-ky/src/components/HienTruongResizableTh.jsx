export default function HienTruongResizableTh({
  colKey,
  fixed,
  children,
  onResizeStart,
  className = "",
  title
}) {
  return (
    <th className={className} title={title}>
      <span className="hientruong-th-label">{children}</span>
      {!fixed ? (
        <div
          className="col-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(colKey, e.clientX);
          }}
          title="Kéo để chỉnh bề rộng cột"
        />
      ) : null}
    </th>
  );
}
