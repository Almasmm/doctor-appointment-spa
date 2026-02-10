import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import { Sidebar } from './Sidebar'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

const adminUser: User = {
  id: 'user-admin-1',
  email: 'admin@example.com',
  fullName: 'Абдрахманова Айнура Сериковна',
  role: 'admin',
}

function renderSidebar(user: User, route = '/app') {
  const store = createAppStore({
    auth: {
      user,
      token: `token-${user.id}`,
      status: 'succeeded',
      error: null,
    },
  })

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Sidebar />
      </MemoryRouter>
    </Provider>,
  )
}

describe('Sidebar', () => {
  it('показывает пациентское меню для роли patient', () => {
    renderSidebar(patientUser)

    expect(screen.getByText('Каталог врачей')).toBeInTheDocument()
    expect(screen.queryByText('Админ: врачи')).not.toBeInTheDocument()
  })

  it('показывает admin меню для роли admin', () => {
    renderSidebar(adminUser)

    expect(screen.getByText('Каталог врачей')).toBeInTheDocument()
    expect(screen.getByText('Админ: врачи')).toBeInTheDocument()
    expect(screen.getByText('Админ: услуги')).toBeInTheDocument()
    expect(screen.getByText('Админ: слоты')).toBeInTheDocument()
    expect(screen.getByText('Админ: записи')).toBeInTheDocument()
  })

  it('не подсвечивает "Панель" на вложенных маршрутах /app/*', () => {
    renderSidebar(patientUser, '/app/profile')

    expect(screen.getByRole('link', { name: 'Панель' })).not.toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Кабинет' })).toHaveAttribute('aria-current', 'page')
  })
})
