/** Nội dung Phụ lục 03 — Hướng dẫn lập, ghi chép sổ đếm xe (TCVN 14182:2024). */

export const DEMXE_GUIDE_LEGAL_BASES = [
  "Căn cứ Thông tư 41/2024/TT-BGTVT ngày 15/11/2024 của Bộ Giao thông vận tải quy định về quản lý, vận hành, khai thác và bảo trì kết cấu hạ tầng đường bộ;",
  "Căn cứ Tiêu chuẩn quốc gia TCVN 14182:2024 Bảo dưỡng thường xuyên đường bộ - Yêu cầu kỹ thuật, ban hành kèm theo quyết định số 1628/QĐ-BKHCN ngày 18/07/2024 của Bộ Khoa học và Công nghệ;",
  "Căn cứ Hợp đồng số 01/2024/HĐ-DVSNC ký ngày 29/3/2024 giữa Sở Giao thông vận tải Sơn La với Liên danh Công ty cổ phần QLSC và XDCT giao thông II Sơn La - Công ty cổ phần phát triển xây dựng và thương mại số 909 - Công ty cổ phần đường bộ 224."
];

export const DEMXE_GUIDE_PURPOSE =
  "Công tác đếm xe là nội dung rất cần thiết cho quản lý giao thông vận tải trên đường bộ, quản lý vận hành giao thông và quy hoạch hệ thống đường bộ. Giúp cho cơ quan quản lý nắm bắt được lưu lượng xe trên tuyến quản lý, dự báo lượng giao thông (lưu lượng và thành phần giao thông), dự báo lượng hành khách hoặc nhu cầu đi lại của dân cư.";

export const DEMXE_GUIDE_REQUIREMENTS = [
  {
    no: "1",
    text:
      "Điều tra giao thông: Tùy thuộc nhiệm vụ cụ thể được phân công hay theo điều kiện hợp đồng, đơn vị thực hiện BDTX đường bộ xây dựng thời gian tiến hành đếm xe, địa điểm đếm xe, nhân xự đếm xe khi bắt đầu thực hiện hợp đồng; thực hiện điều tra giao thông, bao gồm đếm xác định lưu lượng, thành phần xe và điều tra tải trọng xe. Phân loại xe để đếm theo tiêu chuẩn thiết kế đường bộ. Số liệu điều tra giao thông được lập thành báo cáo, cập nhật và lưu giữ trong hệ thống quản lý của đơn vị."
  },
  {
    no: "2",
    text:
      "Thời gian đếm xe: Thực hiện theo kế hoạch được lập bởi đơn vị thực hiện BDTX đường bộ. Thời gian đếm xe tại các trạm đếm có thể tham khảo hướng dẫn sau: Mỗi quý 1 lần, mỗi lần đếm 3 ngày liên tục ở mỗi trạm chính, được thực hiện vào các ngày 5, 6, 7 trong tháng cuối quý. Hai ngày đầu đếm 16/24h (từ 5h đến 21 h), ngày thứ ba đếm 24/24h (từ 0h ngày hôm trước đến 0h ngày hôm sau) để xác định lưu lượng xe trung bình của tháng đó. Trạm phụ có thể tổ chức đếm trong 2 ngày liên tục (ngày 5, 6), với ngày đầu đếm 16/24h (từ 5h đến 21h) và ngày thứ hai đếm 24/24h tương tự như ngày thứ 3 ở trạm chính."
  },
  {
    no: "3",
    text: "Phương pháp đếm xe: Có thể bằng thủ công hoặc đếm xe tự động.",
    bullets: [
      "Đếm thủ công do con người thực hiện. Đếm trên cả 2 hướng đi về của dòng xe trên 1 mặt cắt ngang của đường.",
      "Đếm xe tự động sử dụng thiết bị đếm được thực hiện tùy theo hướng dẫn của từng loại thiết bị. Số liệu đếm được lưu trữ trong máy. Khi sử dụng thiết bị đếm xe, phải duy trì thường xuyên hoạt động của trạm đếm xe bằng thiết bị chuyên dụng với các số liệu được ghi vào máy tính để truyền dữ liệu về cơ quan quản lý cấp trên."
    ]
  }
];

export const DEMXE_GUIDE_REQUIREMENTS_PAGE2 = [
  "Biểu mẫu báo cáo đếm xe và phân loại các phương tiện theo phương pháp đếm thủ công có biểu mẫu kèm theo. Khi sử dụng thiết bị đếm xe thì báo cáo sẽ được xuất trực tiếp từ chương trình tương thích với thiết bị.",
  "Sổ đếm xe được ghi cho từng năm, hết năm đơn vị đưa vào lưu trữ."
];

export const DEMXE_GUIDE_DOSSIER = [
  "Loại hồ sơ: Sổ theo dõi đếm xe Khổ A4 dọc.",
  "Bìa hồ sơ: Trên bìa hồ sơ ghi rõ tên đơn vị trúng thầu QL, BDTX; Tên hạt quản lý; Lý trình quản lý; Tên đường; Thời gian bắt đầu ghi chép từ ngày…./…/…; đến ngày…./…/….; địa điểm..năm .......",
  "Hướng dẫn ghi sổ.",
  "Nội dung: Gồm 2 bảng tổng hợp, cụ thể: Bảng 1: Bảng tổng hợp lưu lượng xe qua lại/ ngày; Bảng 2: Đếm xe theo phân loại phương tiện (chiều đi, chiều về) (có mẫu đính kèm)."
];

export const DEMXE_GUIDE_SUMMARY_REFS = [
  "(01) Ghi chép số thứ tự của các chủng loại xe.",
  "(02) Hướng xe chạy (VD: Cò Mạ - Thuận Châu; Thuận Châu - Cò Mạ).",
  "(03) Các chủng loại xe cần đếm.",
  "(04) Thống kê số lượng đếm xe được của từng ngày thứ nhất, theo từng chủng loại xe.",
  "(05) Thống kê số lượng đếm xe được của từng ngày thứ hai, theo từng chủng loại xe.",
  "(06) Thống kê số lượng đếm xe được của từng ngày thứ ba, theo từng chủng loại xe.",
  "(07) Ghi chú"
];

export const DEMXE_GUIDE_SUPERVISOR =
  "Người giám sát: Do Tuần kiểm tuyến giám sát (Theo quy định điểm b, Khoản 3 điều 16 Thông tư 37/2018/TT-BGTVT của bộ Giao thông vận tải và Công văn số 5357/TCĐBVN của Tổng cục đường bộ Việt Nam ngày 30/8/2017).";

export const DEMXE_GUIDE_TEAM_LEADER =
  "Tổ trưởng tổ đếm xe: Người được đơn vị quản lý đường bộ phân công làm tổ trưởng tổ đếm xe tại trạm.";

export const DEMXE_GUIDE_COUNT_REFS = [
  "(01) Tên đường thực hiện đếm xe",
  "(02) Lý trình tại vị trí đếm xe",
  "(03), (04) Hướng của xe chạy (VD: Cò Mạ - Thuận Châu; Thuận Châu - Cò Mạ).",
  "(05) Ghi cụ thể ngày đếm xe.",
  "(06) Ngày thứ mấy (VD: Thứ 2, thứ 3,...)",
  "(07) Ghi thời gian bắt đầu đếm xe.",
  "(08) Ghi thời gian kết thúc đếm xe.",
  "(09) Số liệu xe đi qua (ví dụ: mỗi xe là một gạch /, có thể gạch hình chữ X trong ô vuông)."
];
