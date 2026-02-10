import { Provider } from 'react-redux'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import type { Appointment } from '@/entities/appointment/model/types'
import type { Doctor } from '@/entities/doctor/model/types'
import type { Slot } from '@/entities/slot/model/types'
import type { User } from '@/entities/user/model/types'
import BookingPage from '@/pages/BookingPage/BookingPage'
import BookingConfirmPage from '@/pages/BookingConfirmPage/BookingConfirmPage'
import { server } from '@/test/msw'
import MyAppointmentsPage from './MyAppointmentsPage'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

const doctorsFixture: Doctor[] = [
  {
    id: 'doctor-1',
    fullName: 'Иванова Мария Сергеевна',
    specialty: 'Терапевт',
    rating: 4.9,
    clinicName: 'Клиника "Здоровье+"',
    serviceIds: ['service-therapist'],
  },
]

function toISO(dayOffset: number, hour: number, minute: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function createFixtures(): { appointments: Appointment[]; slots: Slot[] } {
  return {
    appointments: [
      {
        id: 'appointment-cancel-1',
        userId: patientUser.id,
        doctorId: 'doctor-1',
        slotId: 'slot-cancel-1',
        serviceId: 'service-therapist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Плановый осмотр',
        createdAtISO: toISO(-2, 10, 0),
      },
    ],
    slots: [
      {
        id: 'slot-cancel-1',
        doctorId: 'doctor-1',
        startAtISO: toISO(1, 10, 0),
        endAtISO: toISO(1, 10, 45),
        status: 'booked',
      },
    ],
  }
}

function setupHandlers(appointments: Appointment[], slots: Slot[]): void {
  server.use(
    http.get('*/appointments', async ({ request }) => {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      if (!userId) {
        return HttpResponse.json(appointments)
      }
      return HttpResponse.json(appointments.filter((appointment) => appointment.userId === userId))
    }),
    http.get('*/doctors', async () => HttpResponse.json(doctorsFixture)),
    http.get('*/slots', async () => HttpResponse.json(slots)),
    http.patch('*/appointments/:appointmentId', async ({ params, request }) => {
      const appointmentId = String(params.appointmentId)
      const target = appointments.find((appointment) => appointment.id === appointmentId)
      if (!target) {
        return HttpResponse.json({ message: 'Запись не найдена' }, { status: 404 })
      }

      const body = (await request.json()) as Partial<Appointment>
      target.status = (body.status as Appointment['status']) ?? target.status
      return HttpResponse.json(target)
    }),
    http.patch('*/slots/:slotId', async ({ params, request }) => {
      const slotId = String(params.slotId)
      const target = slots.find((slot) => slot.id === slotId)
      if (!target) {
        return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
      }

      const body = (await request.json()) as Partial<Slot>
      target.status = (body.status as Slot['status']) ?? target.status
      return HttpResponse.json(target)
    }),
  )
}

function renderRoute(initialEntry: string): void {
  const store = createAppStore({
    auth: {
      user: patientUser,
      token: 'token-user-patient-1',
      status: 'succeeded',
      error: null,
    },
  })

  render(
    <Provider store={store}>
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/app/appointments" element={<MyAppointmentsPage />} />
          <Route path="/app/booking/:doctorId" element={<BookingPage />} />
          <Route path="/app/booking/:doctorId/confirm" element={<BookingConfirmPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MyAppointmentsPage integration', () => {
  it('успешно отменяет запись и помечает карточку как отмененную', async () => {
    const { appointments, slots } = createFixtures()
    setupHandlers(appointments, slots)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    renderRoute('/app/appointments')

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    await user.click(screen.getByRole('button', { name: 'Отменить запись' }))

    expect(await screen.findByText('Отменено')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отменить запись' })).not.toBeInTheDocument()
  })

  it('показывает ошибку отмены и даёт повторить запрос', async () => {
    const { appointments, slots } = createFixtures()
    let attempts = 0
    server.use(
      http.get('*/appointments', async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return HttpResponse.json(appointments)
        }
        return HttpResponse.json(appointments.filter((appointment) => appointment.userId === userId))
      }),
      http.get('*/doctors', async () => HttpResponse.json(doctorsFixture)),
      http.get('*/slots', async () => HttpResponse.json(slots)),
      http.patch('*/appointments/:appointmentId', async ({ params, request }) => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        const appointmentId = String(params.appointmentId)
        const target = appointments.find((appointment) => appointment.id === appointmentId)
        if (!target) {
          return HttpResponse.json({ message: 'Запись не найдена' }, { status: 404 })
        }

        const body = (await request.json()) as Partial<Appointment>
        target.status = (body.status as Appointment['status']) ?? target.status
        return HttpResponse.json(target)
      }),
      http.patch('*/slots/:slotId', async ({ params, request }) => {
        const slotId = String(params.slotId)
        const target = slots.find((slot) => slot.id === slotId)
        if (!target) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }

        const body = (await request.json()) as Partial<Slot>
        target.status = (body.status as Slot['status']) ?? target.status
        return HttpResponse.json(target)
      }),
    )

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderRoute('/app/appointments')

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    await user.click(screen.getByRole('button', { name: 'Отменить запись' }))

    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить отмену' }))
    expect(await screen.findByText('Отменено')).toBeInTheDocument()
  })

  it('после отмены запись освобождает слот, и он снова доступен на BookingPage', async () => {
    const { appointments, slots } = createFixtures()
    setupHandlers(appointments, slots)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    const { unmount } = render(
      <Provider
        store={createAppStore({
          auth: {
            user: patientUser,
            token: 'token-user-patient-1',
            status: 'succeeded',
            error: null,
          },
        })}
      >
        <MemoryRouter
          initialEntries={['/app/appointments']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/app/appointments" element={<MyAppointmentsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    await user.click(screen.getByRole('button', { name: 'Отменить запись' }))
    expect(await screen.findByText('Отменено')).toBeInTheDocument()
    expect(slots[0].status).toBe('free')

    unmount()
    renderRoute('/app/booking/doctor-1')

    const slotLabel = await screen.findByText('Слот #slot-cancel-1')
    const slotCard = slotLabel.closest('section')
    expect(slotCard).toBeTruthy()
    expect(within(slotCard as HTMLElement).getByRole('button', { name: 'Выбрать' })).toBeInTheDocument()
  })

  it('переносит запись на новый слот и освобождает старый слот', async () => {
    const appointments: Appointment[] = [
      {
        id: 'appointment-reschedule-1',
        userId: patientUser.id,
        doctorId: 'doctor-1',
        slotId: 'slot-old-1',
        serviceId: 'service-therapist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Плановый осмотр',
        createdAtISO: toISO(-1, 9, 0),
      },
    ]
    const slots: Slot[] = [
      {
        id: 'slot-old-1',
        doctorId: 'doctor-1',
        startAtISO: toISO(1, 11, 0),
        endAtISO: toISO(1, 11, 45),
        status: 'booked',
      },
      {
        id: 'slot-new-1',
        doctorId: 'doctor-1',
        startAtISO: toISO(1, 12, 0),
        endAtISO: toISO(1, 12, 45),
        status: 'free',
      },
    ]
    const holds: Array<{ id: string; slotId: string; userId: string; expiresAtISO: string }> = []

    server.use(
      http.get('*/appointments', async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return HttpResponse.json(appointments)
        }
        return HttpResponse.json(appointments.filter((appointment) => appointment.userId === userId))
      }),
      http.patch('*/appointments/:appointmentId', async ({ params, request }) => {
        const appointmentId = String(params.appointmentId)
        const target = appointments.find((appointment) => appointment.id === appointmentId)
        if (!target) {
          return HttpResponse.json({ message: 'Запись не найдена' }, { status: 404 })
        }

        const body = (await request.json()) as Partial<Appointment>
        Object.assign(target, body)
        return HttpResponse.json(target)
      }),
      http.get('*/doctors', async () => HttpResponse.json(doctorsFixture)),
      http.get('*/slots', async ({ request }) => {
        const url = new URL(request.url)
        const doctorId = url.searchParams.get('doctorId')
        if (!doctorId) {
          return HttpResponse.json(slots)
        }
        return HttpResponse.json(slots.filter((slot) => slot.doctorId === doctorId))
      }),
      http.get('*/slots/:slotId', async ({ params }) => {
        const slot = slots.find((item) => item.id === String(params.slotId))
        if (!slot) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }
        return HttpResponse.json(slot)
      }),
      http.patch('*/slots/:slotId', async ({ params, request }) => {
        const slot = slots.find((item) => item.id === String(params.slotId))
        if (!slot) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }

        const body = (await request.json()) as Partial<Slot>
        Object.assign(slot, body)
        return HttpResponse.json(slot)
      }),
      http.get('*/slotHolds', async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return HttpResponse.json(holds)
        }
        return HttpResponse.json(holds.filter((hold) => hold.userId === userId))
      }),
      http.post('*/slotHolds', async ({ request }) => {
        const body = (await request.json()) as {
          slotId: string
          userId: string
          expiresAtISO: string
        }
        const slot = slots.find((item) => item.id === body.slotId)
        if (!slot) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }
        if (slot.status !== 'free') {
          return HttpResponse.json({ message: 'Слот уже занят' }, { status: 409 })
        }

        const newHold = {
          id: `hold-${holds.length + 1}`,
          slotId: body.slotId,
          userId: body.userId,
          expiresAtISO: body.expiresAtISO,
        }
        holds.push(newHold)
        slot.status = 'held'
        return HttpResponse.json(newHold, { status: 201 })
      }),
      http.delete('*/slotHolds/:slotHoldId', async ({ params }) => {
        const holdId = String(params.slotHoldId)
        const hold = holds.find((item) => item.id === holdId)
        if (hold) {
          const slot = slots.find((item) => item.id === hold.slotId)
          if (slot && slot.status === 'held') {
            slot.status = 'free'
          }
        }
        const nextHolds = holds.filter((item) => item.id !== holdId)
        holds.length = 0
        holds.push(...nextHolds)
        return HttpResponse.json({})
      }),
      http.get('*/users', async () => HttpResponse.json([])),
    )

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderRoute('/app/appointments')

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    await user.click(screen.getByRole('button', { name: 'Перенести' }))

    expect(await screen.findByRole('heading', { name: 'Выбор времени приема' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Выбрать' }))
    await user.click(await screen.findByRole('button', { name: 'Продолжить' }))

    expect(
      await screen.findByRole('heading', { name: 'Подтверждение переноса записи' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Телефон'), '+77017778899')
    await user.clear(screen.getByLabelText('Причина обращения'))
    await user.type(screen.getByLabelText('Причина обращения'), 'Плановый осмотр')
    await user.click(screen.getByRole('button', { name: 'Подтвердить перенос' }))

    expect(await screen.findByRole('heading', { name: 'Мои записи' })).toBeInTheDocument()
    expect(appointments[0].slotId).toBe('slot-new-1')
    expect(slots.find((slot) => slot.id === 'slot-old-1')?.status).toBe('free')
    expect(slots.find((slot) => slot.id === 'slot-new-1')?.status).toBe('booked')
  })
})
