import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import { Header } from './Header'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

function renderHeader() {
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
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </Provider>,
  )

  return { store }
}

describe('Header', () => {
  it('показывает имя пользователя и роль', () => {
    renderHeader()

    expect(screen.getByText('Здравствуйте, Смагулов Айдар Нурланович.')).toBeInTheDocument()
    expect(screen.getByText('Роль: пациент')).toBeInTheDocument()
  })

  it('выполняет logout и переход на главную', async () => {
    const user = userEvent.setup()
    const { store } = renderHeader()

    await user.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(store.getState().auth.user).toBeNull()
    expect(store.getState().auth.token).toBeNull()
    expect(navigateMock).toHaveBeenCalledWith('/')
  })
})
