import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import CatalogPage from './CatalogPage'
import { doctors500Handlers, server } from '@/test/msw'

function renderCatalogPage() {
  const store = createAppStore()

  return render(
    <Provider store={store}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CatalogPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('CatalogPage integration', () => {
  it('показывает врача после успешной загрузки каталога', async () => {
    renderCatalogPage()

    expect(
      await screen.findByRole('heading', { name: 'Иванова Мария Сергеевна' }),
    ).toBeInTheDocument()
  })

  it('показывает карточку ошибки и кнопку повторной загрузки при 500', async () => {
    server.use(
      http.get('*/services', async () =>
        HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
      ),
    )

    renderCatalogPage()

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить каталог' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('показывает retry UI при 500 на doctors API', async () => {
    server.use(...doctors500Handlers)

    renderCatalogPage()

    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить каталог' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })
})
