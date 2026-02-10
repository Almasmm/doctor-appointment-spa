import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { PrivateRoute } from './routes'

describe('PrivateRoute', () => {
  it('редиректит на /login для неавторизованного пользователя', () => {
    const store = createAppStore()

    render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={['/app']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route
              path="/app"
              element={
                <PrivateRoute>
                  <h1>Защищенный контент</h1>
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<h1>Вход в систему</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByRole('heading', { name: 'Вход в систему' })).toBeInTheDocument()
  })
})
