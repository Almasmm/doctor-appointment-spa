import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Slot } from '@/entities/slot/model/types'
import { ASYNC_STATUS, type AsyncStatus } from '@/shared/model/asyncStatus'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { BookingSlotCard } from './BookingSlotCard'

interface SlotsByDate {
  dateKey: string
  dateLabel: string
  slots: Slot[]
}

export interface BookingPresenterProps {
  doctorId: string
  confirmSearchParams: string
  slotsByDate: SlotsByDate[]
  status: AsyncStatus
  error: string | null
  selectedSlotId: string | null
  lastRequestedSlotId: string | null
  holdStatus: AsyncStatus
  holdError: string | null
  canContinue: boolean
  onRetry: () => void
  onSelectSlot: (slotId: string) => void
}

function LoadingSlots() {
  return (
    <div data-testid="booking-slots-skeleton" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`slot-loading-${index}`} className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-24" />
        </Card>
      ))}
    </div>
  )
}

export function BookingPresenter({
  doctorId,
  confirmSearchParams,
  slotsByDate,
  status,
  error,
  selectedSlotId,
  lastRequestedSlotId,
  holdStatus,
  holdError,
  canContinue,
  onRetry,
  onSelectSlot,
}: BookingPresenterProps) {
  const isLoading = status === ASYNC_STATUS.LOADING || status === ASYNC_STATUS.IDLE
  const isFailed = status === ASYNC_STATUS.FAILED
  // PERF: keep pending flag local to the active slot so memoized cards keep stable props.
  const isHoldPending = holdStatus === ASYNC_STATUS.LOADING
  const confirmLink = useMemo(() => {
    if (!selectedSlotId) {
      return `/app/booking/${doctorId}/confirm`
    }

    const params = new URLSearchParams(confirmSearchParams)
    params.set('slotId', selectedSlotId)
    return `/app/booking/${doctorId}/confirm?${params.toString()}`
  }, [confirmSearchParams, doctorId, selectedSlotId])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Выбор времени приема</h2>
        <p className="mt-1 text-sm text-slate-500">
          Выберите удобный слот на ближайшие 7 дней для врача #{doctorId}.
        </p>
      </div>

      {isLoading && <LoadingSlots />}

      {isFailed && (
        <Card title="Не удалось загрузить слоты" description={error ?? 'Повторите попытку позже'}>
          <Button onClick={onRetry}>Повторить</Button>
        </Card>
      )}

      {!isLoading && !isFailed && (
        <>
          {slotsByDate.length > 0 ? (
            <div className="space-y-5">
              {slotsByDate.map((group) => (
                <section key={group.dateKey} className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-800">{group.dateLabel}</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.slots.map((slot) => (
                      <BookingSlotCard
                        key={slot.id}
                        slot={slot}
                        isSelected={slot.id === selectedSlotId}
                        isActionPending={isHoldPending && slot.id === selectedSlotId}
                        showHoldError={
                          Boolean(holdError) &&
                          lastRequestedSlotId === slot.id &&
                          slot.status === 'free'
                        }
                        onSelect={onSelectSlot}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Card title="Свободных слотов нет" description="Попробуйте выбрать другого врача." />
          )}
        </>
      )}

      {holdError && <p className="text-sm text-red-600">{holdError}</p>}

      {canContinue && selectedSlotId && (
        <div className="sticky bottom-4 z-10">
          <Card className="border-brand-200 bg-brand-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-900">
                Слот выбран. Перейдите к подтверждению записи.
              </p>
              <Link to={confirmLink}>
                <Button>Продолжить</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
