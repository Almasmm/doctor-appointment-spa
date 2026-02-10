import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Slot } from '@/entities/slot/model'
import { server } from '@/test/msw'
import AdminSlotsPage from './AdminSlotsPage'

const slotsFixture: Slot[] = [
  {
    id: 'slot-admin-1',
    doctorId: 'doctor-1',
    startAtISO: '2026-02-11T09:00:00.000Z',
    endAtISO: '2026-02-11T09:45:00.000Z',
    status: 'free',
  },
]

function formatDateOffset(daysOffset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('AdminSlotsPage integration', () => {
  it('показывает loading skeleton во время долгой загрузки', async () => {
    server.use(
      http.get('*/slots', async () => {
        await delay(2000)
        return HttpResponse.json(slotsFixture)
      }),
    )

    const { container } = render(<AdminSlotsPage />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(
      await screen.findByRole('heading', { name: 'Ближайшие слоты' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('показывает error card при 500 и кнопку повтора', async () => {
    server.use(
      http.get('*/slots', async () =>
        HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
      ),
    )

    render(<AdminSlotsPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить слоты' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('после retry загружает список слотов', async () => {
    let requestCount = 0
    server.use(
      http.get('*/slots', async () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }
        return HttpResponse.json(slotsFixture)
      }),
    )

    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить слоты' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('heading', { name: 'Ближайшие слоты' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('успешно генерирует новые слоты', async () => {
    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })

    const futureDate = formatDateOffset(7)
    await user.selectOptions(screen.getByLabelText('Врач'), 'doctor-1')
    await user.clear(screen.getByLabelText('Дата начала'))
    await user.type(screen.getByLabelText('Дата начала'), futureDate)
    await user.clear(screen.getByLabelText('Дата окончания'))
    await user.type(screen.getByLabelText('Дата окончания'), futureDate)
    await user.clear(screen.getByLabelText('Начало рабочего дня'))
    await user.type(screen.getByLabelText('Начало рабочего дня'), '09:00')
    await user.clear(screen.getByLabelText('Конец рабочего дня'))
    await user.type(screen.getByLabelText('Конец рабочего дня'), '11:15')
    await user.clear(screen.getByLabelText('Длительность слота (мин)'))
    await user.type(screen.getByLabelText('Длительность слота (мин)'), '45')

    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }))

    expect(
      await screen.findByText('Сгенерировано слотов: 3. Пропущено пересечений: 0.'),
    ).toBeInTheDocument()
  })

  it('показывает ошибку генерации при 500 и позволяет повторить', async () => {
    let attempts = 0
    server.use(
      http.post('*/slots/bulk', async () => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        return HttpResponse.json(
          {
            created: [
              {
                id: 'slot-generated-1',
                doctorId: 'doctor-1',
                startAtISO: '2030-01-01T09:00:00.000Z',
                endAtISO: '2030-01-01T09:45:00.000Z',
                status: 'free',
              },
            ],
            skipped: 0,
          },
          { status: 201 },
        )
      }),
    )

    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })
    const futureDate = formatDateOffset(8)
    await user.selectOptions(screen.getByLabelText('Врач'), 'doctor-1')
    await user.clear(screen.getByLabelText('Дата начала'))
    await user.type(screen.getByLabelText('Дата начала'), futureDate)
    await user.clear(screen.getByLabelText('Дата окончания'))
    await user.type(screen.getByLabelText('Дата окончания'), futureDate)

    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }))
    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить генерацию' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить генерацию' }))
    expect(
      await screen.findByText('Сгенерировано слотов: 1. Пропущено пересечений: 0.'),
    ).toBeInTheDocument()
  })

  it('не даёт сгенерировать слоты в прошлом', async () => {
    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })
    const pastDate = formatDateOffset(-1)
    await user.clear(screen.getByLabelText('Дата начала'))
    await user.type(screen.getByLabelText('Дата начала'), pastDate)
    await user.clear(screen.getByLabelText('Дата окончания'))
    await user.type(screen.getByLabelText('Дата окончания'), pastDate)

    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }))

    expect(await screen.findByText('Нельзя сгенерировать слоты в прошлом')).toBeInTheDocument()
  })

  it('пропускает пересекающиеся слоты при генерации', async () => {
    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })
    const tomorrow = formatDateOffset(1)
    await user.selectOptions(screen.getByLabelText('Врач'), 'doctor-1')
    await user.clear(screen.getByLabelText('Дата начала'))
    await user.type(screen.getByLabelText('Дата начала'), tomorrow)
    await user.clear(screen.getByLabelText('Дата окончания'))
    await user.type(screen.getByLabelText('Дата окончания'), tomorrow)
    await user.clear(screen.getByLabelText('Начало рабочего дня'))
    await user.type(screen.getByLabelText('Начало рабочего дня'), '09:00')
    await user.clear(screen.getByLabelText('Конец рабочего дня'))
    await user.type(screen.getByLabelText('Конец рабочего дня'), '10:30')
    await user.clear(screen.getByLabelText('Длительность слота (мин)'))
    await user.type(screen.getByLabelText('Длительность слота (мин)'), '45')

    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }))

    expect(
      await screen.findByText('Сгенерировано слотов: 0. Пропущено пересечений: 2.'),
    ).toBeInTheDocument()
  })

  it('блокирует и разблокирует свободный слот с обновлением счетчиков', async () => {
    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })
    expect(screen.getByText('Свободно: 4')).toBeInTheDocument()
    expect(screen.getByText('Заблокировано: 0')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Заблокировать' })[0])
    expect(await screen.findByText('Свободно: 3')).toBeInTheDocument()
    expect(screen.getByText('Заблокировано: 1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Разблокировать' }).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Разблокировать' })[0])
    expect(await screen.findByText('Свободно: 4')).toBeInTheDocument()
    expect(screen.getByText('Заблокировано: 0')).toBeInTheDocument()
  })

  it('показывает ошибку изменения статуса слота и позволяет повторить действие', async () => {
    const localSlots: Slot[] = [
      {
        id: 'slot-retry-1',
        doctorId: 'doctor-1',
        startAtISO: '2030-01-01T09:00:00.000Z',
        endAtISO: '2030-01-01T09:45:00.000Z',
        status: 'free',
      },
    ]

    let attempts = 0
    server.use(
      http.get('*/slots', async () => HttpResponse.json(localSlots)),
      http.patch('*/slots/:slotId', async ({ params, request }) => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        const slotId = String(params.slotId)
        const body = (await request.json()) as Partial<Slot>
        const slot = localSlots.find((item) => item.id === slotId)
        if (!slot) {
          return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
        }

        slot.status = (body.status as Slot['status']) ?? slot.status
        return HttpResponse.json(slot)
      }),
    )

    const user = userEvent.setup()
    render(<AdminSlotsPage />)

    await screen.findByRole('heading', { name: 'Ближайшие слоты' })
    await user.click(screen.getByRole('button', { name: 'Заблокировать' }))

    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить изменение' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить изменение' }))

    expect(await screen.findByRole('button', { name: 'Разблокировать' })).toBeInTheDocument()
    expect(screen.getByText('Свободно: 0')).toBeInTheDocument()
    expect(screen.getByText('Заблокировано: 1')).toBeInTheDocument()
  })
})
