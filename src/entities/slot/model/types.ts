export type SlotStatus = 'free' | 'booked' | 'held' | 'blocked'

export interface Slot {
  id: string
  doctorId: string
  startAtISO: string
  endAtISO: string
  status: SlotStatus
}
