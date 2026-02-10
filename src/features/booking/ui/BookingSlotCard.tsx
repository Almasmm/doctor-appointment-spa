import { memo } from 'react'
import type { Slot } from '@/entities/slot/model/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

interface BookingSlotCardProps {
  slot: Slot
  isSelected: boolean
  isActionPending: boolean
  showHoldError: boolean
  onSelect: (slotId: string) => void
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// PERF: slot cards are rendered in grids; memo skips rerenders for unchanged slots.
export const BookingSlotCard = memo(function BookingSlotCard({
  slot,
  isSelected,
  isActionPending,
  showHoldError,
  onSelect,
}: BookingSlotCardProps) {
  const startTime = formatTime(slot.startAtISO)
  const endTime = formatTime(slot.endAtISO)

  const isBooked = slot.status === 'booked'
  const isHeld = slot.status === 'held'
  const isBlocked = slot.status === 'blocked'

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {startTime} - {endTime}
          </p>
          <p className="text-xs text-slate-500">Слот #{slot.id}</p>
        </div>
        {isHeld && (
          <Badge variant={isSelected ? 'success' : 'warning'}>
            {isSelected ? 'Выбрано' : 'Временная бронь'}
          </Badge>
        )}
        {isBooked && <Badge variant="danger">Занято</Badge>}
        {isBlocked && <Badge variant="warning">Недоступно</Badge>}
        {!isBooked && !isHeld && showHoldError && (
          <Badge variant="warning">Не удалось забронировать</Badge>
        )}
      </div>

      {isBooked || isBlocked ? (
        <Button variant="secondary" size="sm" disabled>
          {isBlocked ? 'Недоступно' : 'Занято'}
        </Button>
      ) : (
        <Button
          variant={isSelected ? 'secondary' : 'primary'}
          size="sm"
          disabled={isHeld && !isSelected}
          onClick={() => {
            onSelect(slot.id)
          }}
        >
          {isActionPending && isSelected ? 'Обновляем...' : isSelected ? 'Выбрано' : 'Выбрать'}
        </Button>
      )}
    </Card>
  )
})
