import { Provider } from 'react-redux'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { Appointment } from '@/entities/appointment/model/types'
import type { Doctor } from '@/entities/doctor/model/types'
import type { Service } from '@/entities/service/model/types'
import type { Slot } from '@/entities/slot/model/types'
import type { User } from '@/entities/user/model/types'
import BookingConfirmPage from '@/pages/BookingConfirmPage/BookingConfirmPage'
import BookingPage from '@/pages/BookingPage/BookingPage'
import MyAppointmentsPage from '@/pages/MyAppointmentsPage/MyAppointmentsPage'
import ProfilePage from '@/pages/ProfilePage/ProfilePage'
import AdminSlotsPage from '@/pages/AdminSlotsPage/AdminSlotsPage'
import { server } from '@/test/msw'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

function toISO(dayOffset: number, hour: number, minute: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

describe('Cross-page consistency integration', () => {
  it('после бронирования данные консистентны в MyAppointments, Profile, AdminSlots и Booking', async () => {
    const doctors: Doctor[] = [
      {
        id: 'doctor-1',
        fullName: 'Иванова Мария Сергеевна',
        specialty: 'Терапевт',
        rating: 4.9,
        clinicName: 'Клиника "Здоровье+"',
        serviceIds: ['service-therapist'],
      },
    ]
    const services: Service[] = [
      {
        id: 'service-therapist',
        name: 'Консультация терапевта',
        durationMin: 30,
        priceKzt: 9000,
      },
    ]
    const slots: Slot[] = [
      {
        id: 'slot-consistency-1',
        doctorId: 'doctor-1',
        startAtISO: toISO(1, 10, 0),
        endAtISO: toISO(1, 10, 45),
        status: 'free',
      },
    ]
    const appointments: Appointment[] = []
    const holds: Array<{ id: string; slotId: string; userId: string; expiresAtISO: string }> = []

    server.use(
      http.get('*/services', async () => HttpResponse.json(services)),
      http.get('*/doctors', async () => HttpResponse.json(doctors)),
      http.get('*/users', async ({ request }) => {
        const url = new URL(request.url)
        const email = url.searchParams.get('email')
        if (email === patientUser.email) {
          return HttpResponse.json([patientUser])
        }
        return HttpResponse.json([])
      }),
      http.get('*/slots', async ({ request }) => {
        const url = new URL(request.url)
        const doctorId = url.searchParams.get('doctorId')
        if (!doctorId) {
          return HttpResponse.json(slots)
        }
        return HttpResponse.json(slots.filter((slot) => slot.doctorId === doctorId))
      }),
      http.get('*/slots/:slotId', async ({ params }) => {
        const target = slots.find((slot) => slot.id === String(params.slotId))
        if (!target) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }
        return HttpResponse.json(target)
      }),
      http.patch('*/slots/:slotId', async ({ params, request }) => {
        const target = slots.find((slot) => slot.id === String(params.slotId))
        if (!target) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }
        const body = (await request.json()) as Partial<Slot>
        Object.assign(target, body)
        return HttpResponse.json(target)
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
        const target = slots.find((slot) => slot.id === body.slotId)
        if (!target) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }
        if (target.status !== 'free') {
          return HttpResponse.json({ message: 'Слот уже занят' }, { status: 409 })
        }

        target.status = 'held'
        const hold = {
          id: `hold-${holds.length + 1}`,
          slotId: body.slotId,
          userId: body.userId,
          expiresAtISO: body.expiresAtISO,
        }
        holds.push(hold)
        return HttpResponse.json(hold, { status: 201 })
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
      http.get('*/appointments', async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return HttpResponse.json(appointments)
        }
        return HttpResponse.json(appointments.filter((item) => item.userId === userId))
      }),
      http.post('*/appointments', async ({ request }) => {
        const body = (await request.json()) as Omit<Appointment, 'id'> & { id?: string }
        const appointment: Appointment = {
          ...body,
          id: body.id ?? `appointment-${appointments.length + 1}`,
        }
        appointments.push(appointment)
        return HttpResponse.json(appointment, { status: 201 })
      }),
    )

    const user = userEvent.setup()
    const bookingStore = createAppStore({
      auth: {
        user: patientUser,
        token: 'token-user-patient-1',
        status: 'succeeded',
        error: null,
      },
    })

    const bookingView = render(
      <Provider store={bookingStore}>
        <MemoryRouter
          initialEntries={['/app/booking/doctor-1']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/app/booking/:doctorId" element={<BookingPage />} />
            <Route path="/app/booking/:doctorId/confirm" element={<BookingConfirmPage />} />
            <Route path="/app/appointments" element={<MyAppointmentsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Выбрать' }))
    await user.click(await screen.findByRole('button', { name: 'Продолжить' }))
    await user.type(await screen.findByLabelText('Телефон'), '+77013334455')
    await user.type(screen.getByLabelText('Причина обращения'), 'Плановый осмотр')
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })).toBeInTheDocument()
    expect(appointments.length).toBe(1)
    bookingView.unmount()

    const profileStore = createAppStore({
      auth: {
        user: patientUser,
        token: 'token-user-patient-1',
        status: 'succeeded',
        error: null,
      },
    })
    const profileView = render(
      <Provider store={profileStore}>
        <ProfilePage />
      </Provider>,
    )

    expect(await screen.findByText('Записей: 1')).toBeInTheDocument()
    expect(screen.getByText('Иванова Мария Сергеевна')).toBeInTheDocument()
    profileView.unmount()

    const adminStore = createAppStore({
      auth: {
        user: {
          id: 'user-admin-1',
          email: 'admin@example.com',
          fullName: 'Администратор',
          role: 'admin',
        },
        token: 'token-user-admin-1',
        status: 'succeeded',
        error: null,
      },
    })
    const adminView = render(
      <Provider store={adminStore}>
        <AdminSlotsPage />
      </Provider>,
    )

    expect(await screen.findByText('Занято: 1')).toBeInTheDocument()
    adminView.unmount()

    const bookingCheckStore = createAppStore({
      auth: {
        user: patientUser,
        token: 'token-user-patient-1',
        status: 'succeeded',
        error: null,
      },
    })
    render(
      <Provider store={bookingCheckStore}>
        <MemoryRouter
          initialEntries={['/app/booking/doctor-1']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/app/booking/:doctorId" element={<BookingPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    const slotLabel = await screen.findByText('Слот #slot-consistency-1')
    const slotCard = slotLabel.closest('section')
    expect(slotCard).toBeTruthy()
    expect(within(slotCard as HTMLElement).getByRole('button', { name: 'Занято' })).toBeInTheDocument()
  })
})
