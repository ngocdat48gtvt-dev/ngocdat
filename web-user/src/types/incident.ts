export type IncidentStatus = 'NEW' | 'PARTIAL' | 'DONE'
export type UserRole = 'ADMIN' | 'USER'

export interface IncidentUpdate {
  date: string
  progress: number
  note: string
  images: string[]
  createdBy: string
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
  note?: string
  uuid?: string
  beforeImages?: string[]
  afterImages?: string[]
  status?: IncidentStatus
  progress?: number
  locked?: boolean
  createdAt?: { seconds: number }
  updatedAt?: { seconds: number }
  createdByName?: string
  companyId?: string
  priority?: string
  updates?: IncidentUpdate[]
}

export interface DispatchFilters {
  road: string
  groupName: string
  type: string
  status: string
  dateFrom: string
  dateTo: string
  /** UID users/{uid}/incidents — chủ sự cố trên app */
  ownerUid: string
}

export const emptyDispatchFilters: DispatchFilters = {
  road: '',
  groupName: '',
  type: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  ownerUid: '',
}

export interface MasterDataBundle {
  roads: string[]
  groups: string[]
  typesByGroup: Record<string, string[]>
}
