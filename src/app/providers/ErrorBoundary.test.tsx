import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalErrorBoundary, LocalErrorBoundary } from './ErrorBoundary'

function ThrowRenderError() {
  throw new Error('test error')
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('GlobalErrorBoundary показывает fallback и пишет ошибку в console.error', () => {
    render(
      <GlobalErrorBoundary>
        <ThrowRenderError />
      </GlobalErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Произошла ошибка приложения' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('LocalErrorBoundary показывает fallback и пишет ошибку в console.error', () => {
    render(
      <LocalErrorBoundary>
        <ThrowRenderError />
      </LocalErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Произошла ошибка блока' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
