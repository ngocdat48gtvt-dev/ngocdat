export type IncidentStatus = 'NEW' | 'PARTIAL' | 'DONE'
export type UserRole = 'ADMIN' | 'USER'

export interface IncidentUpdate {
  date: string
  progress: number
  note: string
  images: string[]
  createdBy: string
}

export type ReworkStatus = 'NONE' | 'ASSIGNED' | 'PENDING_APPROVAL' | 'APPROVED'

export type ReworkHistoryType =
  | 'ASSIGNED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REVISION_REQUESTED'

export interface IncidentRework {
  required: boolean
  status: ReworkStatus
  reason: string
  note: string
  assignedAt: string | null
  assignedBy: string
  completedAt: string | null
  approvedAt: string | null
  submissionNote: string
  submissionImages: string[]
}

export interface ReworkHistoryEntry {
  type: ReworkHistoryType
  at: string
  by: string
  reason?: string
  note?: string
  submissionNote?: string
  submissionImages?: string[]
  mergedImageCount?: number
}

export interface IncidentRecord {
  id: string
  ownerUid: string
  incidentId?: string
  road?: string
  groupName?: string
  type?: string
  /** Ngày xảy ra sự cố (dd/MM/yyyy). */
  date?: string
  /** Ngày hoàn thành — tự ghi khi tiến độ ≥ 90%. */
  completedDate?: string
  km?: string
  position?: string
  dai?: number
  rong?: number
  cao?: number
  unit?: string
  /** Sa bồi cống — loại cống (vd. D1000). */
  pipeType?: string
  /** Bão lũ — địa chất: DAT (đất) / DA (đá). */
  geologyType?: string
  /** Bão lũ — tỉ lệ % đất (0..100); -1 = chưa nhập (suy từ geologyType). */
  soilPercent?: number
  note?: string
  uuid?: string
  beforeImages?: string[]
  afterImages?: string[]
  /** Ảnh hiện trạng đã chọn để ghép báo cáo Word (URL hoặc "token:<tên>"). */
  selectedBefore?: string
  /** Ảnh sau xử lý đã chọn để ghép báo cáo Word (URL hoặc "token:<tên>"). */
  selectedAfter?: string
  /** Thứ tự ghép Word: `b:url|a:url|…` — STT = thứ tự trong chuỗi (HT/XL xen kẽ). */
  reportImageOrder?: string
  status?: IncidentStatus
  progress?: number
  locked?: boolean
  createdAt?: { seconds: number }
  updatedAt?: { seconds: number }
  createdByName?: string
  companyId?: string
  priority?: string
  updates?: IncidentUpdate[]
  rework?: IncidentRework
  reworkHistory?: ReworkHistoryEntry[]
}

export interface TrashIncidentRecord extends IncidentRecord {
  deletedAtMs: number
}

export interface DispatchFilters {
  /** Tuyến đường — rỗng = tất cả; nhiều phần tử = lọc OR. */
  roads: string[]
  groupName: string
  /** Loại sự cố — rỗng = tất cả; nhiều phần tử = lọc OR. */
  types: string[]
  /** Tìm theo lý trình — vd. 8+995, Km4+638 */
  chainageQuery: string
  status: string
  dateFrom: string
  dateTo: string
  /** UID users/{uid}/incidents — chủ sự cố trên app; rỗng = tất cả; nhiều phần tử = lọc OR. */
  ownerUids: string[]
}

export const emptyDispatchFilters: DispatchFilters = {
  roads: [],
  groupName: '',
  types: [],
  chainageQuery: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  ownerUids: [],
}

export interface MasterDataBundle {
  roads: string[]
  groups: string[]
  typesByGroup: Record<string, string[]>
  /** Đơn vị theo tên loại sự cố (vd. "Sụt dương" -> "m³"). Tùy chọn, không phá dữ liệu cũ. */
  unitByType?: Record<string, string>
}
