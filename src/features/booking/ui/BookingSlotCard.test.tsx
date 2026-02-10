import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slot } from '@/entities/slot/model/types'
import { BookingSlotCard } from './BookingSlotCard'

function makeSlot(overrides?: Partial<Slot>): Slot {
  return {
    id: 'slot-1',
    doctorId: 'doctor-1',
    startAtISO: '2026-02-10T09:00:00.000Z',
    endAtISO: '2026-02-10T09:45:00.000Z',
    status: 'free',
    ...overrides,
  }
}

describe('BookingSlotCard', () => {
  it('для свободного слота вызывает onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <BookingSlotCard
        slot={makeSlot()}
        isSelected={false}
        isActionPending={false}
        showHoldError={false}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Выбрать' }))
    expect(onSelect).toHaveBeenCalledWith('slot-1')
  })

  it('для занятого слота показывает disabled кнопку', () => {
    render(
      <BookingSlotCard
        slot={makeSlot({ status: 'booked' })}
        isSelected={false}
        isActionPending={false}
        showHoldError={false}
        onSelect={() => {}}
      />,
    )

    const button = screen.getByRole('button', { name: 'Занято' })
    expect(button).toBeDisabled()
  })

  it('показывает предупреждение при ошибке удержания', () => {
    render(
      <BookingSlotCard
        slot={makeSlot()}
        isSelected={false}
        isActionPending={false}
        showHoldError
        onSelect={() => {}}
      />,
    )

    expect(screen.getByText('Не удалось забронировать')).toBeInTheDocument()
  })
})
