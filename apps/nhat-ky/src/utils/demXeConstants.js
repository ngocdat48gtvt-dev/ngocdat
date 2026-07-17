/** Phụ lục 03 — Sổ theo dõi đếm xe (TCVN 14182:2024). */

export const VEHICLE_TYPES = [
  { key: "xeCon", label: "Xe con" },
  { key: "xeTaiNhe", label: "Xe tải hạng nhẹ (2 trục 4 bánh)" },
  { key: "xeTaiTrung", label: "Xe tải hạng trung (2 trục 6 bánh)" },
  { key: "xeTaiNang3", label: "Xe tải hạng nặng (3 trục)" },
  { key: "xeTaiNang4", label: "Xe tải hạng nặng (trên 4 trục trở lên)" },
  { key: "xeKhachNho", label: "Xe khách nhỏ (4 bánh, dưới 20 chỗ)" },
  { key: "xeKhachLon", label: "Xe khách lớn (6 bánh, trên 20 chỗ)" },
  { key: "mayKeo", label: "Máy kéo/ Xe công nông" },
  { key: "xeMay", label: "Xe máy/ Xe lam" },
  { key: "xeDap", label: "Xe đạp/ Xích lô/ Xe súc vật kéo" }
];

export const EMPTY_COUNTS = Object.fromEntries(VEHICLE_TYPES.map((v) => [v.key, ""]));

export const DIRECTION_DI = "di";
export const DIRECTION_VE = "ve";

/** Mỗi đợt đếm gồm 3 ngày liên tiếp (TCVN 14182). */
export const COUNT_BATCH_DAYS = 3;

export const DIRECTION_LABEL = {
  [DIRECTION_DI]: "Chiều đi",
  [DIRECTION_VE]: "Chiều về"
};

export const COVER_DATE_PLACEHOLDER = "........../................./...................";

export const EMPTY_COVER = {
  donVi: "",
  tenHat: "",
  tenDuong: "",
  lyTrinhQuanLy: "",
  ngayBatDau: "",
  ngayKetThuc: "",
  noiKy: "",
  nam: ""
};

export function formatCoverDateLabel(iso) {
  if (!iso) return COVER_DATE_PLACEHOLDER;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return COVER_DATE_PLACEHOLDER;
  return `${d}/${m}/${y}`;
}


export function weekdayVN(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", { weekday: "long" });
}

export function splitDisplayDate(isoDate) {
  if (!isoDate) return { day: "", month: "", year: "" };
  const [y, m, d] = isoDate.split("-");
  return { day: d || "", month: m || "", year: y || "" };
}
