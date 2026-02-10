import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { Appointment } from '@/entities/appointment/model/types'
import type { Doctor } from '@/entities/doctor/model/types'
import type { Slot } from '@/entities/slot/model/types'
import type { User } from '@/entities/user/model/types'
import { server } from '@/test/msw'
import ProfilePage from './ProfilePage'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

function renderProfilePage() {
  const store = createAppStore({
    auth: {
      user: patientUser,
      token: 'token-user-patient-1',
      status: 'succeeded',
      error: null,
    },
  })

  const renderResult = render(
    <Provider store={store}>
      <ProfilePage />
    </Provider>,
  )

  return { store, ...renderResult }
}

describe('ProfilePage integration', () => {
  it('показывает loading state во время загрузки записей', async () => {
    server.use(
      http.get('*/appointments', async () => {
        await delay(2000)
        return HttpResponse.json([])
      }),
    )

    const { container } = renderProfilePage()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(
      await screen.findByText(
        'У вас пока нет предстоящих записей. Откройте каталог, чтобы выбрать врача.',
        undefined,
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })

  it('показывает summary и ближайшую предстоящую запись', async () => {
    const now = Date.now()
    const doctors: Doctor[] = [
      {
        id: 'doctor-past',
        fullName: 'Старый доктор',
        specialty: 'Терапевт',
        rating: 4.7,
        clinicName: 'Клиника А',
        serviceIds: ['service-therapist'],
      },
      {
        id: 'doctor-nearest',
        fullName: 'Ближайший доктор',
        specialty: 'Кардиолог',
        rating: 4.8,
        clinicName: 'Клиника Б',
        serviceIds: ['service-cardiologist'],
      },
      {
        id: 'doctor-far',
        fullName: 'Дальний доктор',
        specialty: 'Эндокринолог',
        rating: 4.9,
        clinicName: 'Клиника В',
        serviceIds: ['service-endocrinologist'],
      },
    ]

    const slots: Slot[] = [
      {
        id: 'slot-past',
        doctorId: 'doctor-past',
        startAtISO: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        endAtISO: new Date(now - 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        status: 'booked',
      },
      {
        id: 'slot-nearest',
        doctorId: 'doctor-nearest',
        startAtISO: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        endAtISO: new Date(now + 2 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        status: 'booked',
      },
      {
        id: 'slot-far',
        doctorId: 'doctor-far',
        startAtISO: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
        endAtISO: new Date(now + 48 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        status: 'booked',
      },
    ]

    const appointments: Appointment[] = [
      {
        id: 'appointment-past',
        userId: patientUser.id,
        doctorId: 'doctor-past',
        slotId: 'slot-past',
        serviceId: 'service-therapist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Контроль',
        createdAtISO: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'appointment-nearest',
        userId: patientUser.id,
        doctorId: 'doctor-nearest',
        slotId: 'slot-nearest',
        serviceId: 'service-cardiologist',
        appointmentType: 'online',
        status: 'scheduled',
        reason: 'Боль в груди',
        createdAtISO: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'appointment-far',
        userId: patientUser.id,
        doctorId: 'doctor-far',
        slotId: 'slot-far',
        serviceId: 'service-endocrinologist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Плановый осмотр',
        createdAtISO: new Date(now - 60 * 60 * 1000).toISOString(),
      },
    ]

    server.use(
      http.get('*/appointments', async () => HttpResponse.json(appointments)),
      http.get('*/doctors', async () => HttpResponse.json(doctors)),
      http.get('*/slots', async () => HttpResponse.json(slots)),
    )

    renderProfilePage()

    expect(await screen.findByText('Записей: 3')).toBeInTheDocument()
    expect(await screen.findByText('Ближайший доктор')).toBeInTheDocument()
    expect(screen.getByText('Тип приема: online')).toBeInTheDocument()
  })

  it('показывает empty state если предстоящих записей нет', async () => {
    const now = Date.now()
    const doctors: Doctor[] = [
      {
        id: 'doctor-past-only',
        fullName: 'Доктор из прошлого',
        specialty: 'Терапевт',
        rating: 4.6,
        clinicName: 'Клиника С',
        serviceIds: ['service-therapist'],
      },
    ]

    const slots: Slot[] = [
      {
        id: 'slot-past-only',
        doctorId: 'doctor-past-only',
        startAtISO: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
        endAtISO: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
        status: 'booked',
      },
    ]

    const appointments: Appointment[] = [
      {
        id: 'appointment-past-only',
        userId: patientUser.id,
        doctorId: 'doctor-past-only',
        slotId: 'slot-past-only',
        serviceId: 'service-therapist',
        appointmentType: 'offline',
        status: 'scheduled',
        reason: 'Проверка',
        createdAtISO: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
      },
    ]

    server.use(
      http.get('*/appointments', async () => HttpResponse.json(appointments)),
      http.get('*/doctors', async () => HttpResponse.json(doctors)),
      http.get('*/slots', async () => HttpResponse.json(slots)),
    )

    renderProfilePage()

    expect(await screen.findByText('Записей: 1')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'У вас пока нет предстоящих записей. Откройте каталог, чтобы выбрать врача.',
      ),
    ).toBeInTheDocument()
  })
})
