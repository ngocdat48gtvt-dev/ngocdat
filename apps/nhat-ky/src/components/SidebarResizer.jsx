/** Thanh kéo giữa menu trái và vùng nội dung. */
export default function SidebarResizer({
  onMouseDown,
  title = "Kéo đổi độ rộng menu trái"
}) {
  return (
    <div
      className="nhaplieu-resizer no-print"
      onMouseDown={onMouseDown}
      title={title}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
