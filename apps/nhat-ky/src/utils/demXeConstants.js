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

export const DIRECTION_LABEL = {
  [DIRECTION_DI]: "Chiều đi",
  [DIRECTION_VE]: "Chiều về"
};

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

export const DEMXE_GUIDE_SECTIONS = [
  {
    title: "I. Mục đích",
    body:
      "Công tác đếm xe là nội dung rất cần thiết cho quản lý giao thông vận tải trên đường bộ, quản lý vận hành giao thông và quy hoạch hệ thống đường bộ. Giúp cho cơ quan quản lý nắm bắt được lưu lượng xe trên tuyến quản lý, dự báo lượng giao thông (lưu lượng và thành phần giao thông), dự báo lượng hành khách hoặc nhu cầu đi lại của dân cư."
  },
  {
    title: "II. Yêu cầu",
    body:
      "Điều tra giao thông theo kế hoạch; phân loại xe theo tiêu chuẩn thiết kế đường bộ. Thời gian đếm xe tại trạm chính: mỗi quý 1 lần, 3 ngày liên tục (ngày 5, 6, 7 tháng cuối quý); hai ngày đầu đếm 16/24h (5h–21h), ngày thứ ba đếm 24/24h. Phương pháp đếm thủ công hoặc tự động; đếm trên cả 2 hướng đi về trên một mặt cắt ngang. Sổ đếm xe được ghi cho từng năm, hết năm đơn vị đưa vào lưu trữ."
  },
  {
    title: "III. Quy cách hồ sơ",
    body:
      "Loại hồ sơ: Sổ theo dõi đếm xe khổ A4 dọc. Bìa ghi: đơn vị QL/BDTX, tên hạt, lý trình quản lý, tên đường, thời gian bắt đầu và kết thúc. Nội dung gồm: (1) Bảng tổng hợp lưu lượng xe qua lại/ngày; (2) Đếm xe theo phân loại phương tiện (chiều đi, chiều về)."
  },
  {
    title: "IV. Hướng dẫn ghi biểu mẫu",
    body:
      "Biểu mẫu đếm: ghi tên đường, lý trình đếm xe, hướng xe chạy (từ → đến), ngày đếm, thời gian bắt đầu/kết thúc, số lượng từng chủng loại xe. Bảng tổng hợp: thống kê theo hướng xe chạy và chủng loại xe cho từng ngày đếm; cộng tự động, không ghi đè tổng bằng tay."
  }
];

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
