import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('показывает заголовок "Запись к врачу"', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Запись к врачу' })).toBeInTheDocument()
  })
})
