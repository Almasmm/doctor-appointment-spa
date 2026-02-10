import { describe, expect, it } from 'vitest'
import type { RootState } from '@/app/store'
import type { AppointmentListItem } from './appointmentsSlice'
import {
  appointmentsReducer,
  cancelMyAppointment,
  fetchMyAppointments,
  selectCancelErrorById,
  selectCancelStatusById,
  selectAppointmentsError,
  selectAppointmentsStatus,
  selectMyAppointments,
} from './appointmentsSlice'

const appointmentItems: AppointmentListItem[] = [
  {
    id: 'appointment-1',
    doctorId: 'doctor-1',
    slotId: 'slot-1',
    doctorName: 'Иванова Мария Сергеевна',
    startAtISO: '2026-02-12T10:00:00.000Z',
    appointmentType: 'offline',
    status: 'scheduled',
    reason: 'Плановый осмотр',
  },
  {
    id: 'appointment-2',
    doctorId: 'doctor-2',
    slotId: 'slot-2',
    doctorName: 'Петров Алексей Викторович',
    startAtISO: '2026-02-13T11:00:00.000Z',
    appointmentType: 'online',
    status: 'scheduled',
    reason: 'Контроль после лечения',
  },
]

describe('appointmentsSlice', () => {
  it('обрабатывает pending/fulfilled/rejected для fetchMyAppointments', () => {
    const pendingState = appointmentsReducer(
      undefined,
      fetchMyAppointments.pending('req-1', 'user-patient-1'),
    )
    expect(pendingState.status).toBe('loading')
    expect(pendingState.error).toBeNull()

    const fulfilledState = appointmentsReducer(
      pendingState,
      fetchMyAppointments.fulfilled(appointmentItems, 'req-1', 'user-patient-1'),
    )
    expect(fulfilledState.status).toBe('succeeded')
    expect(fulfilledState.items).toEqual(appointmentItems)

    const rejectedState = appointmentsReducer(
      fulfilledState,
      fetchMyAppointments.rejected(
        new Error('network'),
        'req-2',
        'user-patient-1',
        'Не удалось загрузить список записей',
      ),
    )
    expect(rejectedState.status).toBe('failed')
    expect(rejectedState.error).toBe('Не удалось загрузить список записей')
  })

  it('обрабатывает pending/fulfilled/rejected для cancelMyAppointment', () => {
    const loadedState = appointmentsReducer(
      undefined,
      fetchMyAppointments.fulfilled(appointmentItems, 'req-1', 'user-patient-1'),
    )

    const pendingState = appointmentsReducer(
      loadedState,
      cancelMyAppointment.pending('req-2', { appointmentId: 'appointment-1', slotId: 'slot-1' }),
    )
    expect(pendingState.cancelStatusById['appointment-1']).toBe('loading')
    expect(pendingState.cancelErrorById['appointment-1']).toBeNull()

    const fulfilledState = appointmentsReducer(
      pendingState,
      cancelMyAppointment.fulfilled(
        { appointmentId: 'appointment-1', status: 'cancelled' },
        'req-2',
        { appointmentId: 'appointment-1', slotId: 'slot-1' },
      ),
    )
    expect(fulfilledState.cancelStatusById['appointment-1']).toBe('idle')
    expect(fulfilledState.items.find((item) => item.id === 'appointment-1')?.status).toBe(
      'cancelled',
    )

    const rejectedState = appointmentsReducer(
      fulfilledState,
      cancelMyAppointment.rejected(
        new Error('network'),
        'req-3',
        { appointmentId: 'appointment-2', slotId: 'slot-2' },
        'Не удалось отменить запись',
      ),
    )
    expect(rejectedState.cancelStatusById['appointment-2']).toBe('failed')
    expect(rejectedState.cancelErrorById['appointment-2']).toBe('Не удалось отменить запись')
  })

  it('selectors читают appointments state', () => {
    const loadedState = appointmentsReducer(
      undefined,
      fetchMyAppointments.fulfilled(appointmentItems, 'req-1', 'user-patient-1'),
    )

    const rootState = {
      appointments: loadedState,
    } as RootState

    expect(selectAppointmentsStatus(rootState)).toBe('succeeded')
    expect(selectAppointmentsError(rootState)).toBeNull()
    expect(selectMyAppointments(rootState)).toEqual(appointmentItems)
    expect(selectCancelStatusById(rootState, 'appointment-1')).toBe('idle')
    expect(selectCancelErrorById(rootState, 'appointment-1')).toBeNull()
  })
})
