import {
  incidentMissingKm,
  incidentNeedsMetadataRecovery,
  parseRecoverableMetadata,
  type RecoverableIncidentMetadata,
} from '@/lib/incidentMetadataParse'
import { updateIncidentRecord, type IncidentPatch } from '@/services/incidentsService'
import type { IncidentRecord } from '@/types/incident'

function buildRecoveryPatch(
  inc: IncidentRecord,
  parsed: RecoverableIncidentMetadata,
): IncidentPatch | null {
  const patch: IncidentPatch = {}

  if (incidentMissingKm(inc) && parsed.km) patch.km = parsed.km
  if (!(inc.road ?? '').trim() && parsed.road) patch.road = parsed.road
  if (!(inc.type ?? '').trim() && parsed.type) patch.type = parsed.type
  if (!(inc.date ?? '').trim() && parsed.date) patch.date = parsed.date
  if (!(inc.position ?? '').trim() && parsed.position) patch.position = parsed.position

  return Object.keys(patch).length > 0 ? patch : null
}

export async function recoverIncidentMetadata(
  ownerUid: string,
  docId: string,
  incident: IncidentRecord,
): Promise<{ patch: IncidentPatch; source: string } | null> {
  const parsed = parseRecoverableMetadata(incident)
  if (!parsed) return null

  const patch = buildRecoveryPatch(incident, parsed)
  if (!patch) return null

  await updateIncidentRecord(ownerUid, docId, patch, {
    companyId: incident.companyId,
  })

  return { patch, source: parsed.source }
}

export function countIncidentsNeedingMetadataRecovery(
  incidents: IncidentRecord[],
  options?: {
    ownerUid?: string
    isCompanyAdmin?: boolean
  },
): number {
  const uid = options?.ownerUid ?? ''
  const isAdmin = options?.isCompanyAdmin ?? false
  return incidents.filter(
    (inc) =>
      incidentNeedsMetadataRecovery(inc) &&
      (isAdmin || !uid || inc.ownerUid === uid),
  ).length
}

/** Khôi phục lý trình (và tuyến/loại nếu trống) từ mã sự cố — không đụng kích thước. */
export async function recoverAllMissingMetadata(
  incidents: IncidentRecord[],
  options?: {
    maxIncidents?: number
    ownerUid?: string
    isCompanyAdmin?: boolean
    onProgress?: (done: { recovered: number; totalKm: number }) => void
  },
): Promise<{ recovered: number; fields: number }> {
  const max = options?.maxIncidents ?? 80
  const uid = options?.ownerUid ?? ''
  const isAdmin = options?.isCompanyAdmin ?? false

  const candidates = incidents.filter(
    (inc) =>
      incidentNeedsMetadataRecovery(inc) &&
      (isAdmin || !uid || inc.ownerUid === uid),
  )

  let recovered = 0
  let fields = 0
  const limit = Math.min(candidates.length, max)

  for (let i = 0; i < limit; i++) {
    const inc = candidates[i]
    const result = await recoverIncidentMetadata(inc.ownerUid, inc.id, inc)
    if (!result) continue
    recovered++
    fields += Object.keys(result.patch).length
    if (result.patch.km) inc.km = result.patch.km
    if (result.patch.road) inc.road = result.patch.road
    if (result.patch.type) inc.type = result.patch.type
    if (result.patch.date) inc.date = result.patch.date
    if (result.patch.position) inc.position = result.patch.position
    options?.onProgress?.({ recovered, totalKm: recovered })
    if (i % 4 === 3) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return { recovered, fields }
}
