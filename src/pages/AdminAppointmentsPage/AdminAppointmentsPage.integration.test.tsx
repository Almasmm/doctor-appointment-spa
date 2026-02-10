import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { Appointment } from '@/entities/appointment/model/types'
import type { Slot } from '@/entities/slot/model/types'
import { server } from '@/test/msw'
import AdminAppointmentsPage from './AdminAppointmentsPage'

function renderAdminAppointmentsPage() {
  const store = createAppStore({
    auth: {
      user: {
        id: 'user-admin-1',
        email: 'admin@example.com',
        fullName: 'Админ',
        role: 'admin',
        verified: true,
      },
      token: 'token-admin',
      status: 'succeeded',
      error: null,
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter
        initialEntries={['/app/admin/appointments']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/app/admin/appointments" element={<AdminAppointmentsPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('AdminAppointmentsPage integration', () => {
  it('показывает loading skeleton во время долгой загрузки', async () => {
    server.use(
      http.get('*/appointments', async () => {
        await delay(400)
        return HttpResponse.json([])
      }),
      http.get('*/doctors', async () => HttpResponse.json([])),
      http.get('*/slots', async () => HttpResponse.json([])),
    )

    renderAdminAppointmentsPage()

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(await screen.findByText('Записи по текущим фильтрам не найдены.')).toBeInTheDocument()
  })

  it('показывает 500 и после retry загружает записи', async () => {
    const doctors = [
      {
        id: 'doctor-1',
        fullName: 'Иванова Мария Сергеевна',
        specialty: 'Терапевт',
        rating: 4.9,
        clinicName: 'Клиника',
        serviceIds: ['service-therapist'],
      },
    ]
    const slots: Slot[] = [
      {
        id: 'slot-1',
        doctorId: 'doctor-1',
        startAtISO: '2026-02-20T09:00:00.000Z',
        endAtISO: '2026-02-20T09:45:00.000Z',
        status: 'booked',
      },
    ]
    const appointments: Appointment[] = [
      {
        id: 'appointment-1',
        userId: 'user-patient-1',
        doctorId: 'doctor-1',
        slotId: 'slot-1',
        serviceId: 'service-therapist',
        appointmentType: 'online',
        status: 'scheduled',
        reason: 'Плановая проверка',
        createdAtISO: '2026-02-19T10:00:00.000Z',
      },
    ]

    let shouldFail = true
    server.use(
      http.get('*/appointments', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        return HttpResponse.json(appointments)
      }),
      http.get('*/doctors', async () => HttpResponse.json(doctors)),
      http.get('*/slots', async () => HttpResponse.json(slots)),
    )

    const user = userEvent.setup()
    renderAdminAppointmentsPage()

    expect(await screen.findByText('Не удалось загрузить записи')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Плановая проверка')).toBeInTheDocument()
  })

  it('обновляет статус записи: completed и cancelled', async () => {
    const doctors = [
      {
        id: 'doctor-1',
        fullName: 'Иванова Мария Сергеевна',
        specialty: 'Терапевт',
        rating: 4.9,
        clinicName: 'Клиника',
        serviceIds: ['service-therapist'],
      },
    ]

    let slots: Slot[] = [
      {
        id: 'slot-1',
        doctorId: 'doctor-1',
        startAtISO: '2026-02-20T09:00:00.000Z',
        endAtISO: '2026-02-20T09:45:00.000Z',
        status: 'booked',
      },
      {
        id: 'slot-2',
        doctorId: 'doctor-1',
        startAtISO: '2026-02-20T10:00:00.000Z',
        endAtISO: '2026-02-20T10:45:00.000Z',
        status: 'booked',
      },
    ]

    let appointments: Appointment[] = [
      {
        id: 'appointment-1',
        userId: 'user-patient-1',
        doctorId: 'doctor-1',
        slotId: 'slot-1',
        serviceId: 'service-therapist',
        appointmentType: 'online',
        status: 'scheduled',
        reason: 'Плановая проверка',
        createdAtISO: '2026-02-19T10:00:00.000Z',
      },
      {
        id: 'appointment-2',
        userId: 'user-patient-2',
        doctorId: 'doctor-1',
        slotId: 'slot-2',
        serviceId: 'service-therapist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Повторная консультация',
        createdAtISO: '2026-02-19T11:00:00.000Z',
      },
    ]

    server.use(
      http.get('*/appointments', async () => HttpResponse.json(appointments)),
      http.get('*/doctors', async () => HttpResponse.json(doctors)),
      http.get('*/slots', async () => HttpResponse.json(slots)),
      http.patch('*/appointments/:appointmentId', async ({ params, request }) => {
        const appointmentId = String(params.appointmentId)
        const payload = (await request.json()) as Partial<Appointment>

        appointments = appointments.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                status: payload.status ?? appointment.status,
              }
            : appointment,
        )

        const updated = appointments.find((appointment) => appointment.id === appointmentId)
        return HttpResponse.json(updated)
      }),
      http.patch('*/slots/:slotId', async ({ params, request }) => {
        const slotId = String(params.slotId)
        const payload = (await request.json()) as Partial<Slot>

        slots = slots.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                status: payload.status ?? slot.status,
              }
            : slot,
        )

        const updated = slots.find((slot) => slot.id === slotId)
        return HttpResponse.json(updated)
      }),
    )

    const user = userEvent.setup()
    renderAdminAppointmentsPage()

    expect(await screen.findByText('Плановая проверка')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Отметить завершенной' })[0])
    expect(await screen.findByText('Завершено: 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(await screen.findByText('Отменено: 1')).toBeInTheDocument()
  })
})
