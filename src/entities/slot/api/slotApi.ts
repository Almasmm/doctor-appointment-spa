import type { Slot } from '@/entities/slot/model/types'
import { http } from '@/shared/lib/http'
import type { SlotStatus } from '@/entities/slot/model/types'

interface GetSlotsParams {
  doctorId: string
  fromISO: string
  toISO: string
}

export async function getSlots({ doctorId, fromISO, toISO }: GetSlotsParams): Promise<Slot[]> {
  const query = new URLSearchParams({ doctorId })
  const slots = await http<Slot[]>(`/slots?${query.toString()}`)
  const fromTimestamp = Date.parse(fromISO)
  const toTimestamp = Date.parse(toISO)

  return slots.filter((slot) => {
    const slotTimestamp = Date.parse(slot.startAtISO)
    return (
      Number.isFinite(slotTimestamp) &&
      slotTimestamp >= fromTimestamp &&
      slotTimestamp <= toTimestamp
    )
  })
}

export async function getAllSlots(): Promise<Slot[]> {
  return http<Slot[]>('/slots')
}

export async function getSlotById(slotId: string): Promise<Slot> {
  return http<Slot>(`/slots/${slotId}`)
}

export async function updateSlotStatus(slotId: string, status: SlotStatus): Promise<Slot> {
  return http<Slot>(`/slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export interface GenerateSlotsPayload {
  doctorId: string
  dateFrom: string
  dateTo: string
  workStart: string
  workEnd: string
  durationMin: number
  stepMin?: number
}

export interface GenerateSlotsResult {
  created: Slot[]
  skipped: number
}

export async function generateSlotsBulk(
  payload: GenerateSlotsPayload,
): Promise<GenerateSlotsResult> {
  return http<GenerateSlotsResult>('/slots/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
