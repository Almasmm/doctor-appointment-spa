import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw'
import ResetPasswordPage from './ResetPasswordPage'

function renderResetPasswordPage(token = 'reset-token-demo') {
  render(
    <MemoryRouter initialEntries={[`/reset-password/${token}`]}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/login" element={<h1>LOGIN</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage integration', () => {
  it('успешно обновляет пароль и переводит на экран успеха', async () => {
    server.use(http.post('*/auth/reset-password', async () => HttpResponse.json({})))

    const user = userEvent.setup()
    renderResetPasswordPage()

    await user.type(screen.getByLabelText('Новый пароль'), 'newPassword123')
    await user.type(screen.getByLabelText('Подтверждение пароля'), 'newPassword123')
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

    expect(await screen.findByText('Пароль обновлён')).toBeInTheDocument()
  })

  it('показывает ошибку и даёт повторить', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.post('*/auth/reset-password', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json(
            { message: 'Ссылка для сброса пароля недействительна' },
            { status: 404 },
          )
        }

        return HttpResponse.json({})
      }),
    )

    renderResetPasswordPage()

    await user.type(screen.getByLabelText('Новый пароль'), 'newPassword123')
    await user.type(screen.getByLabelText('Подтверждение пароля'), 'newPassword123')
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

    expect(await screen.findByText('Ссылка для сброса пароля недействительна')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Пароль обновлён')).toBeInTheDocument()
  })
})
