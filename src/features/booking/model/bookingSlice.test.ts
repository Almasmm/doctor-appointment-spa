import { describe, expect, it } from 'vitest'
import type { Slot } from '@/entities/slot/model/types'
import {
  bookingReducer,
  fetchDoctorSlots,
  holdSlot,
  releaseHold,
  selectSlot,
} from './bookingSlice'

function makeSlot(id: string): Slot {
  const baseStart = new Date('2026-02-10T09:00:00.000Z')
  const start = new Date(baseStart)
  start.setHours(baseStart.getHours() + Number(id.slice(-1)) || 0)
  const end = new Date(start.getTime() + 45 * 60 * 1000)

  return {
    id,
    doctorId: 'doctor-1',
    startAtISO: start.toISOString(),
    endAtISO: end.toISOString(),
    status: 'free',
  }
}

describe('bookingSlice reducer', () => {
  it('не сбрасывает selectedSlotId при holdSlot.rejected и сохраняет lastRequestedSlotId', () => {
    const slot = makeSlot('slot-1')
    const loadedState = bookingReducer(
      undefined,
      fetchDoctorSlots.fulfilled([slot], 'req-load', {
        doctorId: 'doctor-1',
        fromISO: '2026-02-10T00:00:00.000Z',
        toISO: '2026-02-17T23:59:59.999Z',
      }),
    )
    const selectedState = bookingReducer(loadedState, selectSlot(slot.id))
    const nextState = bookingReducer(
      selectedState,
      holdSlot.rejected(new Error('409'), 'req-hold', { slotId: slot.id }, 'Слот уже занят'),
    )

    expect(nextState.selectedSlotId).toBe(slot.id)
    expect(nextState.lastRequestedSlotId).toBe(slot.id)
    expect(nextState.holdError).toBe('Слот уже занят')
    expect(nextState.holdStatus).toBe('failed')
  })

  it('корректно обрабатывает rapid switch: hold A -> release A -> hold B', () => {
    const slotA = makeSlot('slot-1')
    const slotB = makeSlot('slot-2')

    let state = bookingReducer(
      undefined,
      fetchDoctorSlots.fulfilled([slotA, slotB], 'req-load', {
        doctorId: 'doctor-1',
        fromISO: '2026-02-10T00:00:00.000Z',
        toISO: '2026-02-17T23:59:59.999Z',
      }),
    )

    state = bookingReducer(state, selectSlot(slotA.id))
    state = bookingReducer(state, holdSlot.pending('req-hold-a', { slotId: slotA.id }))
    state = bookingReducer(
      state,
      holdSlot.fulfilled(
        {
          id: 'hold-a',
          slotId: slotA.id,
          userId: 'user-1',
          expiresAtISO: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        'req-hold-a',
        { slotId: slotA.id },
      ),
    )

    state = bookingReducer(state, releaseHold.pending('req-release-a'))
    state = bookingReducer(
      state,
      releaseHold.fulfilled({ released: true, slotId: slotA.id }, 'req-release-a', undefined),
    )

    state = bookingReducer(state, selectSlot(slotB.id))
    state = bookingReducer(state, holdSlot.pending('req-hold-b', { slotId: slotB.id }))
    state = bookingReducer(
      state,
      holdSlot.fulfilled(
        {
          id: 'hold-b',
          slotId: slotB.id,
          userId: 'user-1',
          expiresAtISO: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        'req-hold-b',
        { slotId: slotB.id },
      ),
    )

    expect(state.selectedSlotId).toBe(slotB.id)
    expect(state.hold?.slotId).toBe(slotB.id)
    expect(state.lastRequestedSlotId).toBe(slotB.id)
    expect(state.slots.find((slot) => slot.id === slotA.id)?.status).toBe('free')
    expect(state.slots.find((slot) => slot.id === slotB.id)?.status).toBe('held')
  })
})

