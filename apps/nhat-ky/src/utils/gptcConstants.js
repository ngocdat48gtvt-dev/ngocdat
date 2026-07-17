export const EMPTY_PERMIT_ENTRY = {
  ngay: "",
  dienBien: "",
  yKienHatTruong: "",
  yKienTuanKiem: ""
};

export const EMPTY_PERMIT = {
  tenCongTrinh: "",
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
  permits: []
};
