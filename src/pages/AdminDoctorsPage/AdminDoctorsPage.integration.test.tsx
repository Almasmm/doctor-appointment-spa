import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { doctorFixtures } from '@/test/msw/handlers'
import { server } from '@/test/msw'
import AdminDoctorsPage from './AdminDoctorsPage'

describe('AdminDoctorsPage integration', () => {
  it('показывает loading skeleton во время долгой загрузки', async () => {
    server.use(
      http.get('*/doctors', async () => {
        await delay(2000)
        return HttpResponse.json(doctorFixtures)
      }),
    )

    const { container } = render(<AdminDoctorsPage />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(
      await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('показывает error card при 500 и кнопку повтора', async () => {
    server.use(
      http.get('*/doctors', async () =>
        HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
      ),
    )

    render(<AdminDoctorsPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить врачей' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('после retry загружает список врачей', async () => {
    let requestCount = 0
    server.use(
      http.get('*/doctors', async () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }
        return HttpResponse.json(doctorFixtures)
      }),
    )

    const user = userEvent.setup()
    render(<AdminDoctorsPage />)

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить врачей' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('создаёт врача с выбранными услугами', async () => {
    const user = userEvent.setup()
    render(<AdminDoctorsPage />)

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })

    await user.type(screen.getByLabelText('ID'), 'doctor-custom-1')
    await user.type(screen.getByLabelText('ФИО'), 'Тестовый Врач')
    await user.type(screen.getByLabelText('Специализация'), 'Терапевт')
    await user.type(screen.getByLabelText('Клиника'), 'Клиника Тест')
    await user.clear(screen.getByLabelText('Рейтинг (0-5)'))
    await user.type(screen.getByLabelText('Рейтинг (0-5)'), '4.4')
    await user.click(screen.getByLabelText('Консультация терапевта'))
    await user.click(screen.getByRole('button', { name: 'Добавить врача' }))

    expect(await screen.findByRole('heading', { name: 'Тестовый Врач' })).toBeInTheDocument()
    expect(screen.getByText('Всего врачей: 3')).toBeInTheDocument()
  })

  it('редактирует врача и обновляет назначенные услуги', async () => {
    const user = userEvent.setup()
    render(<AdminDoctorsPage />)

    const doctorHeading = await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    const doctorArticle = doctorHeading.closest('article')
    expect(doctorArticle).toBeTruthy()

    await user.click(
      within(doctorArticle as HTMLElement).getByRole('button', { name: 'Редактировать' }),
    )
    await user.clear(screen.getByLabelText('ФИО'))
    await user.type(screen.getByLabelText('ФИО'), 'Иванова Мария Сергеевна+')
    await user.click(screen.getByLabelText('Консультация кардиолога'))
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    expect(
      await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна+' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Рейтинг: 4.9 · Услуг: 2')).toBeInTheDocument()
  })

  it('удаляет врача из списка', async () => {
    const user = userEvent.setup()
    render(<AdminDoctorsPage />)

    const doctorHeading = await screen.findByRole('heading', { name: 'Петров Алексей Викторович' })
    const doctorArticle = doctorHeading.closest('article')
    expect(doctorArticle).toBeTruthy()

    await user.click(
      within(doctorArticle as HTMLElement).getByRole('button', { name: 'Удалить' }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Петров Алексей Викторович' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('Всего врачей: 1')).toBeInTheDocument()
  })

  it('показывает ошибку при create 500 и позволяет повторить сохранение', async () => {
    let createAttempts = 0
    server.use(
      http.post('*/doctors', async ({ request }) => {
        createAttempts += 1
        if (createAttempts === 1) {
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        const body = (await request.json()) as {
          id: string
          fullName: string
          specialty: string
          clinicName: string
          rating: number
          serviceIds: string[]
        }

        return HttpResponse.json(body, { status: 201 })
      }),
    )

    const user = userEvent.setup()
    render(<AdminDoctorsPage />)

    await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' })
    await user.type(screen.getByLabelText('ID'), 'doctor-custom-2')
    await user.type(screen.getByLabelText('ФИО'), 'Врач С Ошибкой')
    await user.type(screen.getByLabelText('Специализация'), 'Терапевт')
    await user.type(screen.getByLabelText('Клиника'), 'Клиника Тест')
    await user.clear(screen.getByLabelText('Рейтинг (0-5)'))
    await user.type(screen.getByLabelText('Рейтинг (0-5)'), '4.2')
    await user.click(screen.getByLabelText('Консультация терапевта'))

    await user.click(screen.getByRole('button', { name: 'Добавить врача' }))
    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Добавить врача' }))
    expect(await screen.findByRole('heading', { name: 'Врач С Ошибкой' })).toBeInTheDocument()
  })
})
