export const EMPTY_PERMIT_ENTRY = {
  ngay: "",
  dienBien: "",
  yKienHatTruong: "",
  yKienTuanKiem: ""
};

export const EMPTY_PERMIT = {
  tenCongTrinh: "",
  /** Tên trên BM02 — độc lập cột 2 BM01 */
  tenCongTrinhBm02: "",
  soNgayCapPhep: "",
  ngayBanGiao: "",
  donViDuocCap: "",
  noiDungCapPhep: "",
  ngayBatDau: "",
  ngayKetThuc: "",
  ghiChu: "",
  entries: []
};

export const EMPTY_GPTC_LEDGER = {
  year: String(new Date().getFullYear()),
  tenTuyen: "",
  summaryColWidths: null,
  detailColWidths: null,
  permits: [],
  /** Id công trình đã xóa — merge đa máy không được hồi sinh. */
  deletedPermitIds: [],
  /** Id dòng BM02 đã xóa. */
  deletedEntryIds: []
};
