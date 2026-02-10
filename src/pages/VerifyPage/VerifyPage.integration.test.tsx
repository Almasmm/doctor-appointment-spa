import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw'
import VerifyPage from './VerifyPage'

function renderVerifyPage(token = 'verify-token-1') {
  render(
    <MemoryRouter initialEntries={[`/verify/${token}`]}>
      <Routes>
        <Route path="/verify/:token" element={<VerifyPage />} />
        <Route path="/login" element={<h1>LOGIN</h1>} />
        <Route path="/signup" element={<h1>SIGNUP</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('VerifyPage integration', () => {
  it('показывает успех и переход на /login', async () => {
    server.use(
      http.post('*/auth/verify', async () => HttpResponse.json({ message: 'Аккаунт подтверждён' })),
    )

    const user = userEvent.setup()
    renderVerifyPage()

    expect(await screen.findByText('Аккаунт подтверждён')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Перейти ко входу' }))

    expect(await screen.findByRole('heading', { name: 'LOGIN' })).toBeInTheDocument()
  })

  it('показывает ошибку и позволяет повторить', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    server.use(
      http.post('*/auth/verify', async () => {
        if (shouldFail) {
          shouldFail = false
          return HttpResponse.json(
            { message: 'Ссылка подтверждения недействительна' },
            { status: 404 },
          )
        }

        return HttpResponse.json({ message: 'Аккаунт подтверждён' })
      }),
    )

    renderVerifyPage()

    expect(await screen.findByText('Ссылка подтверждения недействительна')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Аккаунт подтверждён')).toBeInTheDocument()
  })
})
