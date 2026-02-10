import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  checkAndCleanupExpiredHold,
  fetchDoctorSlots,
  holdSlot,
  releaseHold,
  selectBookingError,
  selectBookingStatus,
  selectHold,
  selectHoldError,
  selectHoldStatus,
  selectLastRequestedSlotId,
  selectSelectedSlotId,
  selectSlot,
  selectSlots,
} from '@/features/booking/model'
import { ASYNC_STATUS } from '@/shared/model/asyncStatus'
import { BookingPresenter } from './BookingPresenter'

interface BookingContainerProps {
  doctorId: string
  confirmSearchParams: string
}

function getSlotsRange(): { fromISO: string; toISO: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  end.setHours(23, 59, 59, 999)

  return {
    fromISO: start.toISOString(),
    toISO: end.toISOString(),
  }
}

export function BookingContainer({ doctorId, confirmSearchParams }: BookingContainerProps) {
  const dispatch = useAppDispatch()
  const slots = useAppSelector(selectSlots)
  const status = useAppSelector(selectBookingStatus)
  const error = useAppSelector(selectBookingError)
  const selectedSlotId = useAppSelector(selectSelectedSlotId)
  const lastRequestedSlotId = useAppSelector(selectLastRequestedSlotId)
  const hold = useAppSelector(selectHold)
  const holdStatus = useAppSelector(selectHoldStatus)
  const holdError = useAppSelector(selectHoldError)
  const queuedSlotRef = useRef<string | null>(null)

  // PERF: fixed range avoids re-fetch callback churn on every render.
  const range = useMemo(() => getSlotsRange(), [])

  const loadSlots = useCallback(() => {
    void dispatch(
      fetchDoctorSlots({
        doctorId,
        fromISO: range.fromISO,
        toISO: range.toISO,
      }),
    )
  }, [dispatch, doctorId, range.fromISO, range.toISO])

  useEffect(() => {
    const bootstrap = async () => {
      await dispatch(checkAndCleanupExpiredHold())
      void dispatch(
        fetchDoctorSlots({
          doctorId,
          fromISO: range.fromISO,
          toISO: range.toISO,
        }),
      )
    }

    void bootstrap()
  }, [dispatch, doctorId, range.fromISO, range.toISO])

  const executeSlotSelection = useCallback(
    async (slotId: string) => {
      if (hold?.slotId === slotId) {
        dispatch(selectSlot(slotId))
        return
      }

      if (hold) {
        const releaseResult = await dispatch(releaseHold())
        if (releaseHold.rejected.match(releaseResult)) {
          return
        }
      }

      dispatch(selectSlot(slotId))
      await dispatch(holdSlot({ slotId }))
    },
    [dispatch, hold],
  )

  const handleSelectSlot = useCallback(
    (slotId: string) => {
      if (holdStatus === ASYNC_STATUS.LOADING) {
        queuedSlotRef.current = slotId
        return
      }

      void executeSlotSelection(slotId)
    },
    [executeSlotSelection, holdStatus],
  )

  useEffect(() => {
    const queuedSlotId = queuedSlotRef.current

    if (holdStatus === ASYNC_STATUS.LOADING || !queuedSlotId) {
      return
    }

    queuedSlotRef.current = null

    if (hold?.slotId === queuedSlotId) {
      dispatch(selectSlot(queuedSlotId))
      return
    }

    void executeSlotSelection(queuedSlotId)
  }, [dispatch, executeSlotSelection, hold?.slotId, holdStatus])

  // PERF: expensive sorting/grouping runs only when slots collection changes.
  const slotsByDate = useMemo(() => {
    const sortedSlots = [...slots].sort(
      (left, right) =>
        new Date(left.startAtISO).getTime() - new Date(right.startAtISO).getTime(),
    )

    const grouped = new Map<string, typeof sortedSlots>()

    for (const slot of sortedSlots) {
      const key = slot.startAtISO.slice(0, 10)
      const slotGroup = grouped.get(key) ?? []
      slotGroup.push(slot)
      grouped.set(key, slotGroup)
    }

    return Array.from(grouped.entries()).map(([dateKey, daySlots]) => ({
      dateKey,
      dateLabel: new Date(daySlots[0].startAtISO).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
      slots: daySlots,
    }))
  }, [slots])

  const canContinue =
    holdStatus === ASYNC_STATUS.SUCCEEDED &&
    hold !== null &&
    selectedSlotId !== null &&
    hold.slotId === selectedSlotId

  return (
    <BookingPresenter
      doctorId={doctorId}
      confirmSearchParams={confirmSearchParams}
      slotsByDate={slotsByDate}
      status={status}
      error={error}
      selectedSlotId={selectedSlotId}
      lastRequestedSlotId={lastRequestedSlotId}
      holdStatus={holdStatus}
      holdError={holdError}
      canContinue={canContinue}
      onRetry={loadSlots}
      onSelectSlot={handleSelectSlot}
    />
  )
}
