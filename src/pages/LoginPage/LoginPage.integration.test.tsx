import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { server } from '@/test/msw'
import LoginPage from './LoginPage'

describe('LoginPage integration', () => {
  it('успешно выполняет логин и редиректит в /app', async () => {
    const store = createAppStore()
    const user = userEvent.setup()

    render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={['/login']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<h1>APP</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    await user.type(screen.getByLabelText('Email'), 'patient@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'patient123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('heading', { name: 'APP' })).toBeInTheDocument()
  })

  it('показывает сообщение для неподтверждённого аккаунта', async () => {
    server.use(
      http.post('*/auth/login', async () =>
        HttpResponse.json({ message: 'Подтвердите email перед входом' }, { status: 403 }),
      ),
    )

    const store = createAppStore()
    const user = userEvent.setup()

    render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={['/login']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    await user.type(screen.getByLabelText('Email'), 'unverified@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText('Подтвердите email перед входом')).toBeInTheDocument()
  })

  it('показывает retry при временной ошибке сервера', async () => {
    let shouldFail = true
    server.use(
      http.post('*/auth/login', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        return HttpResponse.json({
          user: {
            id: 'user-patient-1',
            email: 'patient@example.com',
            fullName: 'Смагулов Айдар Нурланович',
            role: 'patient',
            verified: true,
          },
          token: 'token-retry',
        })
      }),
    )

    const store = createAppStore()
    const user = userEvent.setup()

    render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={['/login']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<h1>APP</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    await user.type(screen.getByLabelText('Email'), 'patient@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'patient123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(
      await screen.findByText('Сервис временно недоступен. Попробуйте позже'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByRole('heading', { name: 'APP' })).toBeInTheDocument()
  })
})
