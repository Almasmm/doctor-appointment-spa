import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import { fetchDoctorSlots, holdSlot } from './bookingSlice'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

const secondUser: User = {
  id: 'user-admin-1',
  email: 'admin@example.com',
  fullName: 'Абдрахманова Айнура Сериковна',
  role: 'admin',
}

function createAuthedStore(user: User) {
  return createAppStore({
    auth: {
      user,
      token: `token-${user.id}`,
      status: 'succeeded',
      error: null,
    },
  })
}

function getSlotsRange(): { fromISO: string; toISO: string } {
  const start = new Date()
  start.setDate(start.getDate() - 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 9)
  end.setHours(23, 59, 59, 999)

  return {
    fromISO: start.toISOString(),
    toISO: end.toISOString(),
  }
}

describe('bookingSlice integration', () => {
  it('возвращает 409 для второго пользователя при hold одного и того же слота', async () => {
    const firstStore = createAuthedStore(patientUser)
    const secondStore = createAuthedStore(secondUser)
    const { fromISO, toISO } = getSlotsRange()

    await firstStore.dispatch(fetchDoctorSlots({ doctorId: 'doctor-1', fromISO, toISO }))
    await secondStore.dispatch(fetchDoctorSlots({ doctorId: 'doctor-1', fromISO, toISO }))

    const targetSlotId = firstStore
      .getState()
      .booking.slots.find((slot) => slot.status === 'free')?.id

    expect(targetSlotId).toBeTruthy()

    const firstHoldResult = await firstStore.dispatch(holdSlot({ slotId: String(targetSlotId) }))
    expect(holdSlot.fulfilled.match(firstHoldResult)).toBe(true)

    const secondHoldResult = await secondStore.dispatch(holdSlot({ slotId: String(targetSlotId) }))
    expect(holdSlot.rejected.match(secondHoldResult)).toBe(true)
    if (holdSlot.rejected.match(secondHoldResult)) {
      expect(secondHoldResult.payload).toBe('Слот уже занят')
    }
  })
})

