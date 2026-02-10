import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import BookingPage from './BookingPage'
import { conflictHoldHandlers, delayedSlotsHandlers, server, slots500Handlers } from '@/test/msw'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

function renderBookingPage() {
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
        initialEntries={['/app/booking/doctor-1']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/app/booking/:doctorId" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )

  return { store }
}

describe('BookingPage integration', () => {
  it('успешно загружает слоты и после выбора показывает кнопку продолжения', async () => {
    const user = userEvent.setup()
    const { store } = renderBookingPage()

    const firstChooseButton = (await screen.findAllByRole('button', { name: 'Выбрать' }))[0]
    await user.click(firstChooseButton)

    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeInTheDocument()
    expect(store.getState().booking.hold).not.toBeNull()
  })

  it('показывает ошибку при 500 от slots API', async () => {
    server.use(...slots500Handlers)
    renderBookingPage()

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить слоты' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('показывает ошибку при 404 от slots API', async () => {
    server.use(
      http.get('*/slots', async () =>
        HttpResponse.json({ message: 'Слоты не найдены' }, { status: 404 }),
      ),
    )
    renderBookingPage()

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить слоты' }),
    ).toBeInTheDocument()
  })

  it('показывает skeleton во время долгой загрузки слотов', async () => {
    server.use(...delayedSlotsHandlers)
    renderBookingPage()

    expect(screen.getByTestId('booking-slots-skeleton')).toBeInTheDocument()
    const chooseButtons = await screen.findAllByRole(
      'button',
      { name: 'Выбрать' },
      { timeout: 4000 },
    )
    expect(chooseButtons.length).toBeGreaterThan(0)
  })

  it('корректно обрабатывает быстрый выбор двух слотов и оставляет второй', async () => {
    let holdCounter = 100
    server.use(
      http.post('*/slotHolds', async ({ request }) => {
        await delay(250)
        const body = (await request.json()) as { slotId: string; userId: string; expiresAtISO: string }
        return HttpResponse.json(
          {
            id: `test-hold-${holdCounter++}`,
            slotId: body.slotId,
            userId: body.userId,
            expiresAtISO: body.expiresAtISO,
          },
          { status: 201 },
        )
      }),
    )

    const user = userEvent.setup()
    const { store } = renderBookingPage()

    await screen.findAllByRole('button', { name: 'Выбрать' })
    const freeSlotIds = store
      .getState()
      .booking.slots.filter((slot) => slot.status === 'free')
      .map((slot) => slot.id)
    const expectedSecondSlotId = freeSlotIds[1]

    const chooseButtons = await screen.findAllByRole('button', { name: 'Выбрать' })
    const firstClick = user.click(chooseButtons[0])
    const secondClick = user.click(chooseButtons[1])
    await Promise.all([firstClick, secondClick])

    await waitFor(() => {
      expect(store.getState().booking.hold?.slotId).toBe(expectedSecondSlotId)
      expect(store.getState().booking.selectedSlotId).toBe(expectedSecondSlotId)
    })
  })

  it('показывает ошибку 409 при конфликте hold и не даёт продолжить', async () => {
    server.use(...conflictHoldHandlers)

    const user = userEvent.setup()
    const { store } = renderBookingPage()
    const firstChooseButton = (await screen.findAllByRole('button', { name: 'Выбрать' }))[0]

    await user.click(firstChooseButton)

    expect(await screen.findByText('Слот уже занят')).toBeInTheDocument()
    expect(store.getState().booking.hold).toBeNull()
    expect(store.getState().booking.selectedSlotId).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Продолжить' })).not.toBeInTheDocument()
  })
})
