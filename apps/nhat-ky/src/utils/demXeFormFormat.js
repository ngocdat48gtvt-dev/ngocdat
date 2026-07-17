/** Hiển thị giờ đếm xe theo mẫu: 5h00', 21h00', 0h00', 23h59'. */
export function formatDemXeTime(hhmm) {
  if (!hhmm) return "";
  const [h, m = "00"] = String(hhmm).split(":");
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return "";
  return `${hour}h${m.padStart(2, "0")}'`;
}

export function parseDemXeTime(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(\d{1,2})h(\d{2})'?$/i);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Bỏ dấu tiếng Việt — dùng cho tên địa danh hướng xe (mẫu không dấu). */
export function stripVietnameseMarks(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
