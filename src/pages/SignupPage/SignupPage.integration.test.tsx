import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw'
import SignupPage from './SignupPage'

function renderSignupPage() {
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SignupPage integration', () => {
  it('показывает ссылку подтверждения после успешной регистрации', async () => {
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText('ФИО'), 'Тестовый Пациент')
    await user.type(screen.getByLabelText('Email'), 'new.patient@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Подтверждение пароля'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(await screen.findByText('Проверьте почту')).toBeInTheDocument()
    const verifyLink = screen.getByRole('link', { name: /\/verify\//i })
    expect(verifyLink).toHaveAttribute('href', expect.stringMatching(/^\/verify\//))
  })

  it('показывает ошибку если email уже занят', async () => {
    const user = userEvent.setup()
    renderSignupPage()

    const emailInput = screen.getByLabelText('Email')
    await user.type(emailInput, 'patient@example.com')
    await user.tab()

    expect(await screen.findByText('Пользователь с таким email уже существует')).toBeInTheDocument()
  })

  it('показывает retry если signup временно недоступен', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.post('*/auth/signup', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        return HttpResponse.json(
          {
            user: {
              id: 'user-patient-test',
              email: 'retry.patient@example.com',
              fullName: 'Retry Patient',
              role: 'patient',
              verified: false,
            },
            verificationToken: 'verify-token-retry',
          },
          { status: 201 },
        )
      }),
    )

    renderSignupPage()

    await user.type(screen.getByLabelText('ФИО'), 'Retry Patient')
    await user.type(screen.getByLabelText('Email'), 'retry.patient@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Подтверждение пароля'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Проверьте почту')).toBeInTheDocument()
  })
})
