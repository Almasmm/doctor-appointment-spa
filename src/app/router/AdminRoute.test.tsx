import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import { AdminRoute } from './routes'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

describe('AdminRoute', () => {
  it('редиректит пациента с /app/admin/doctors на /app', () => {
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
        <MemoryRouter
          initialEntries={['/app/admin/doctors']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route
              path="/app/admin/doctors"
              element={
                <AdminRoute>
                  <h1>Админ раздел</h1>
                </AdminRoute>
              }
            />
            <Route path="/app" element={<h1>APP</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByRole('heading', { name: 'APP' })).toBeInTheDocument()
  })
})
