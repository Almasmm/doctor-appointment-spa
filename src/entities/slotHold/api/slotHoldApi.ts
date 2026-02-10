import type { SlotHold } from '@/entities/slotHold/model/types'
import { http } from '@/shared/lib/http'

export async function createSlotHold(slotId: string, userId: string): Promise<SlotHold> {
  const expiresAtISO = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  return http<SlotHold>('/slotHolds', {
    method: 'POST',
    body: JSON.stringify({
      slotId,
      userId,
      expiresAtISO,
    }),
  })
}

export async function deleteSlotHold(slotHoldId: string): Promise<void> {
  await http<Record<string, never>>(`/slotHolds/${slotHoldId}`, {
    method: 'DELETE',
  })
}

export async function getSlotHoldsByUser(userId: string): Promise<SlotHold[]> {
  const query = new URLSearchParams({ userId })
  return http<SlotHold[]>(`/slotHolds?${query.toString()}`)
}
