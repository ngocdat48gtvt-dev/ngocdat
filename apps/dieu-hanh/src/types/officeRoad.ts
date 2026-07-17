export interface OfficeRoad {
  id: string
  label: string
  roadName: string
  hat: string
  kmFrom: string
  kmTo: string
  kmRange: string
  company: string
  createdAt?: string
  updatedAt?: string
}

export interface OfficeRoadsCatalog {
  activeRoadId: string
  roads: OfficeRoad[]
}

export interface OfficeRoadDraft {
  roadName: string
  hat: string
  kmFrom: string
  kmTo: string
  company: string
}
