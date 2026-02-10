import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { serviceFixtures } from '@/test/msw/handlers'
import { server } from '@/test/msw'
import AdminServicesPage from './AdminServicesPage'

describe('AdminServicesPage integration', () => {
  it('показывает loading skeleton во время долгой загрузки', async () => {
    server.use(
      http.get('*/services', async () => {
        await delay(2000)
        return HttpResponse.json(serviceFixtures)
      }),
    )

    const { container } = render(<AdminServicesPage />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(
      await screen.findByRole('heading', { name: 'Консультация терапевта' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('показывает error card при 500 и кнопку повтора', async () => {
    server.use(
      http.get('*/services', async () =>
        HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
      ),
    )

    render(<AdminServicesPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить услуги' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('после retry загружает список услуг', async () => {
    let requestCount = 0
    server.use(
      http.get('*/services', async () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }
        return HttpResponse.json(serviceFixtures)
      }),
    )

    const user = userEvent.setup()
    render(<AdminServicesPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить услуги' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('heading', { name: 'Консультация терапевта' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('создаёт новую услугу и отображает её в списке', async () => {
    const user = userEvent.setup()
    render(<AdminServicesPage />)

    await screen.findByRole('heading', { name: 'Консультация терапевта' })

    await user.type(screen.getByLabelText('Название'), 'МРТ')
    await user.type(screen.getByLabelText('Длительность (мин)'), '60')
    await user.type(screen.getByLabelText('Стоимость (₸)'), '25000')
    await user.click(screen.getByRole('button', { name: 'Добавить услугу' }))

    expect(await screen.findByRole('heading', { name: 'МРТ' })).toBeInTheDocument()
    expect(screen.getByText('Всего услуг: 5')).toBeInTheDocument()
  })

  it('редактирует услугу и обновляет данные в списке', async () => {
    const user = userEvent.setup()
    render(<AdminServicesPage />)

    const serviceHeading = await screen.findByRole('heading', { name: 'Консультация терапевта' })
    const serviceArticle = serviceHeading.closest('article')
    expect(serviceArticle).toBeTruthy()

    await user.click(
      within(serviceArticle as HTMLElement).getByRole('button', { name: 'Редактировать' }),
    )
    await user.clear(screen.getByLabelText('Название'))
    await user.type(screen.getByLabelText('Название'), 'Консультация терапевта+')
    await user.clear(screen.getByLabelText('Длительность (мин)'))
    await user.type(screen.getByLabelText('Длительность (мин)'), '35')
    await user.clear(screen.getByLabelText('Стоимость (₸)'))
    await user.type(screen.getByLabelText('Стоимость (₸)'), '9500')
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    expect(
      await screen.findByRole('heading', { name: 'Консультация терапевта+' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Длительность: 35 мин · Стоимость: 9500 ₸')).toBeInTheDocument()
  })

  it('удаляет услугу из списка', async () => {
    const user = userEvent.setup()
    render(<AdminServicesPage />)

    const serviceHeading = await screen.findByRole('heading', { name: 'Консультация кардиолога' })
    const serviceArticle = serviceHeading.closest('article')
    expect(serviceArticle).toBeTruthy()

    await user.click(
      within(serviceArticle as HTMLElement).getByRole('button', { name: 'Удалить' }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Консультация кардиолога' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('Всего услуг: 3')).toBeInTheDocument()
  })

  it('показывает ошибку при create 500 и позволяет повторить сохранение', async () => {
    let createAttempts = 0
    server.use(
      http.post('*/services', async ({ request }) => {
        createAttempts += 1
        if (createAttempts === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        const body = (await request.json()) as {
          name: string
          durationMin: number
          priceKzt: number
        }

        return HttpResponse.json(
          {
            id: 'service-mri',
            name: body.name,
            durationMin: body.durationMin,
            priceKzt: body.priceKzt,
          },
          { status: 201 },
        )
      }),
    )

    const user = userEvent.setup()
    render(<AdminServicesPage />)

    await screen.findByRole('heading', { name: 'Консультация терапевта' })
    await user.type(screen.getByLabelText('Название'), 'МРТ')
    await user.type(screen.getByLabelText('Длительность (мин)'), '60')
    await user.type(screen.getByLabelText('Стоимость (₸)'), '25000')

    await user.click(screen.getByRole('button', { name: 'Добавить услугу' }))
    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Добавить услугу' }))
    expect(await screen.findByRole('heading', { name: 'МРТ' })).toBeInTheDocument()
  })
})
