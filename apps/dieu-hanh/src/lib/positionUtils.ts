/** Khớp SideUtils.kt trên Android */
export function positionLabel(code?: string): string {
  if (!code?.trim()) return '—'
  switch (code.trim().toUpperCase()) {
    case 'T':
      return 'Trái'
    case 'P':
      return 'Phải'
    case 'M':
      return 'Giữa'
    case 'TIM':
    case 'TI':
      return 'Tim đường'
    case 'TL':
      return 'Thượng lưu'
    case 'HL':
      return 'Hạ lưu'
    case 'LC':
      return 'Lòng cống'
    case 'HT':
      return 'Hố tụ'
    case 'TTHL':
      return 'Thanh thải hạ lưu'
    default:
      return code
  }
}
