import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw'
import ForgotPasswordPage from './ForgotPasswordPage'

function renderForgotPasswordPage() {
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<h1>LOGIN</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage integration', () => {
  it('показывает dev ссылку для сброса', async () => {
    server.use(
      http.post('*/auth/forgot-password', async () =>
        HttpResponse.json({ resetToken: 'reset-token-demo' }),
      ),
    )

    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'patient@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    const link = await screen.findByRole('link', { name: /\/reset-password\//i })
    expect(link).toHaveAttribute('href', '/reset-password/reset-token-demo')
  })

  it('показывает ошибку и позволяет повторить', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.post('*/auth/forgot-password', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
        }

        return HttpResponse.json({ resetToken: null })
      }),
    )

    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'patient@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    expect(await screen.findByText('Внутренняя ошибка сервера')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByText('Ссылка отправлена (или email не найден в системе).'),
    ).toBeInTheDocument()
  })
})
