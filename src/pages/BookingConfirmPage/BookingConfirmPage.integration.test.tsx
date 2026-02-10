import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import type { Slot } from '@/entities/slot/model/types'
import type { User } from '@/entities/user/model/types'
import BookingConfirmPage from './BookingConfirmPage'
import { delayedBookingConfirmHandlers, server, slotById404Handlers } from '@/test/msw'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

const defaultSlot: Slot = {
  id: 'slot-doctor-1-1',
  doctorId: 'doctor-1',
  startAtISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  endAtISO: new Date(Date.now() + 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
  status: 'free',
}

const validPhone = '+77011234567'

interface RenderConfirmPageOptions {
  route?: string
  slotInState?: Slot | null
  withAppointmentsRoute?: boolean
  hold?: {
    id: string
    slotId: string
    userId: string
    expiresAtISO: string
  } | null
}

function renderConfirmPage({
  route = '/app/booking/doctor-1/confirm?slotId=slot-doctor-1-1',
  slotInState = defaultSlot,
  withAppointmentsRoute = false,
  hold = null,
}: RenderConfirmPageOptions = {}) {
  const store = createAppStore({
    auth: {
      user: patientUser,
      token: 'token-user-patient-1',
      status: 'succeeded',
      error: null,
    },
    booking: {
      slots: slotInState ? [slotInState] : [],
      status: 'succeeded',
      error: null,
      selectedSlotId: slotInState?.id ?? null,
      lastRequestedSlotId: slotInState?.id ?? null,
      hold,
      holdStatus: hold ? 'succeeded' : 'idle',
      holdError: null,
    },
  })

  const view = render(
    <Provider store={store}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/app/booking/:doctorId/confirm" element={<BookingConfirmPage />} />
          {withAppointmentsRoute && (
            <Route path="/app/appointments" element={<h1>Мои записи</h1>} />
          )}
        </Routes>
      </MemoryRouter>
    </Provider>,
  )

  return { store, ...view }
}

describe('BookingConfirmPage integration', () => {
  it('показывает ошибку если слот уже занят на момент подтверждения', async () => {
    server.use(
      http.get('*/slots/:slotId', async ({ params }) =>
        HttpResponse.json({ ...defaultSlot, id: String(params.slotId), status: 'booked' }),
      ),
    )

    const user = userEvent.setup()
    renderConfirmPage()

    expect(await screen.findByRole('option', { name: 'Консультация терапевта' })).toBeInTheDocument()
    const serviceSelect = await screen.findByLabelText('Услуга')
    await user.selectOptions(serviceSelect, 'service-therapist')
    await user.type(
      screen.getByLabelText('Причина обращения'),
      'Контрольный осмотр после лечения',
    )
    await user.type(screen.getByLabelText('Телефон'), validPhone)
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(await screen.findByRole('heading', { name: 'Слот уже занят' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вернуться к слотам' })).toBeInTheDocument()
  })

  it('показывает сообщение об истечении hold при загрузке страницы', async () => {
    renderConfirmPage({
      hold: {
        id: 'slot-hold-expired',
        slotId: defaultSlot.id,
        userId: patientUser.id,
        expiresAtISO: new Date(Date.now() - 60_000).toISOString(),
      },
    })

    expect(await screen.findByRole('heading', { name: 'Время брони истекло' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вернуться к слотам' })).toBeInTheDocument()
  })

  it('при уходе со страницы без подтверждения снимает hold и освобождает слот', async () => {
    const deleteHoldSpy = vi.fn()
    const patchSlotSpy = vi.fn()
    server.use(
      http.delete('*/slotHolds/:slotHoldId', async () => {
        deleteHoldSpy()
        return HttpResponse.json({})
      }),
      http.patch('*/slots/:slotId', async ({ params }) => {
        patchSlotSpy()
        return HttpResponse.json({ ...defaultSlot, id: String(params.slotId), status: 'free' })
      }),
    )

    const { unmount } = renderConfirmPage({
      slotInState: { ...defaultSlot, status: 'held' },
      hold: {
        id: 'slot-hold-active',
        slotId: defaultSlot.id,
        userId: patientUser.id,
        expiresAtISO: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    })

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    unmount()

    await waitFor(() => {
      expect(deleteHoldSpy).toHaveBeenCalledTimes(1)
      expect(patchSlotSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('показывает skeleton во время загрузки слота по id', async () => {
    server.use(
      http.get('*/slots/:slotId', async ({ params }) => {
        await delay(2000)
        return HttpResponse.json({ ...defaultSlot, id: String(params.slotId) })
      }),
    )

    renderConfirmPage({ slotInState: null })

    expect(screen.getByTestId('booking-confirm-skeleton')).toBeInTheDocument()
    expect(await screen.findByLabelText('Услуга', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('показывает error UI при 404 для slot by id', async () => {
    server.use(...slotById404Handlers)

    renderConfirmPage({
      route: '/app/booking/doctor-1/confirm?slotId=slot-missing',
      slotInState: null,
    })

    expect(await screen.findByRole('heading', { name: 'Слот не найден' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вернуться к слотам' })).toBeInTheDocument()
  })

  it('показывает loading state во время долгого confirm booking запроса', async () => {
    server.use(...delayedBookingConfirmHandlers)

    const user = userEvent.setup()
    renderConfirmPage({ withAppointmentsRoute: true })

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    await user.type(
      screen.getByLabelText('Причина обращения'),
      'Контроль после длительного лечения',
    )
    await user.type(screen.getByLabelText('Телефон'), validPhone)
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(screen.getByRole('button', { name: 'Подтверждаем...' })).toBeDisabled()
    expect(
      await screen.findByRole('heading', { name: 'Мои записи' }, { timeout: 6000 }),
    ).toBeInTheDocument()
  })

  it('показывает pending-индикатор и блокирует submit при async email validation (200)', async () => {
    server.use(
      http.get('*/users', async ({ request }) => {
        const url = new URL(request.url)
        const email = url.searchParams.get('email')
        const password = url.searchParams.get('password')

        if (email && !password) {
          await delay(2000)
          return HttpResponse.json([])
        }

        if (email && password) {
          return HttpResponse.json([])
        }

        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderConfirmPage()

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    const emailInput = screen.getByLabelText('Email для подтверждения')

    await user.clear(emailInput)
    await user.type(emailInput, 'new.patient@example.com')
    await user.tab()

    expect(await screen.findByText('Проверяем доступность email...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверяем email...' })).toBeDisabled()
    expect(
      await screen.findByRole('button', { name: 'Подтвердить' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  it('показывает async ошибку, если email уже используется (409)', async () => {
    server.use(
      http.get('*/users', async ({ request }) => {
        const url = new URL(request.url)
        const email = url.searchParams.get('email')
        const password = url.searchParams.get('password')

        if (email && !password) {
          return HttpResponse.json(
            { message: 'Этот email уже используется. Укажите другой.' },
            { status: 409 },
          )
        }

        if (email && password) {
          return HttpResponse.json([])
        }

        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderConfirmPage()

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    const emailInput = screen.getByLabelText('Email для подтверждения')

    await user.clear(emailInput)
    await user.type(emailInput, 'already.used@example.com')
    await user.tab()

    expect(await screen.findByText('Этот email уже используется. Укажите другой.')).toBeInTheDocument()
  })

  it('успешно проходит happy path с валидными email и phone', async () => {
    const user = userEvent.setup()
    renderConfirmPage({ withAppointmentsRoute: true })

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    await user.type(screen.getByLabelText('Телефон'), validPhone)
    await user.type(screen.getByLabelText('Причина обращения'), 'Плановая ежегодная консультация')
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(await screen.findByRole('heading', { name: 'Мои записи' })).toBeInTheDocument()
  })

  it('асинхронно валидирует дублирующуюся причину обращения', async () => {
    server.use(
      http.get('*/appointments', async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')

        if (userId !== patientUser.id) {
          return HttpResponse.json([])
        }

        return HttpResponse.json([
          {
            id: 'appointment-existing',
            userId: patientUser.id,
            doctorId: 'doctor-1',
            slotId: 'slot-doctor-1-4',
            serviceId: 'service-therapist',
            appointmentType: 'offline',
            status: 'scheduled',
            reason: 'Повторный контроль',
            createdAtISO: new Date().toISOString(),
          },
        ])
      }),
    )

    const user = userEvent.setup()
    renderConfirmPage()

    await screen.findByRole('option', { name: 'Консультация терапевта' })
    await user.type(screen.getByLabelText('Причина обращения'), 'Повторный контроль')
    await user.type(screen.getByLabelText('Телефон'), validPhone)
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(
      await screen.findByText('У вас уже есть запись с такой причиной. Уточните описание.'),
    ).toBeInTheDocument()
  })
})
