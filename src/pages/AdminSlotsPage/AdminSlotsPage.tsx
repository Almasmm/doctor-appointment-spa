import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDoctors } from '@/entities/doctor/api'
import type { Doctor } from '@/entities/doctor/model'
import { generateSlotsBulk, getAllSlots, updateSlotStatus } from '@/entities/slot/api'
import type { GenerateSlotsPayload } from '@/entities/slot/api'
import type { Slot } from '@/entities/slot/model'
import type { SlotStatus } from '@/entities/slot/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

function LoadingSlots() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`admin-slot-loading-${index}`} className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-48" />
        </Card>
      ))}
    </div>
  )
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTomorrowDateInputValue(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return toDateInputValue(tomorrow)
}

function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [dateFrom, setDateFrom] = useState(getTomorrowDateInputValue)
  const [dateTo, setDateTo] = useState(getTomorrowDateInputValue)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [durationMin, setDurationMin] = useState('45')
  const [formError, setFormError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [generationSummary, setGenerationSummary] = useState<string | null>(null)
  const [slotActionError, setSlotActionError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<GenerateSlotsPayload | null>(null)
  const [lastSlotAction, setLastSlotAction] = useState<{ slotId: string; status: SlotStatus } | null>(
    null,
  )

  const loadPageData = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const [slotsData, doctorsData] = await Promise.all([getAllSlots(), getDoctors()])
      setSlots(slotsData)
      setDoctors(doctorsData)
      setDoctorId((currentValue) => {
        if (currentValue && doctorsData.some((doctor) => doctor.id === currentValue)) {
          return currentValue
        }
        return doctorsData[0]?.id ?? ''
      })
      setStatus('succeeded')
    } catch (loadError) {
      setStatus('failed')
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить слоты')
    }
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const handleRetry = useCallback(() => {
    void loadPageData()
  }, [loadPageData])

  const validateGenerationForm = useCallback((): GenerateSlotsPayload | null => {
    const normalizedDoctorId = doctorId.trim()
    const normalizedDateFrom = dateFrom.trim()
    const normalizedDateTo = dateTo.trim()
    const normalizedWorkStart = workStart.trim()
    const normalizedWorkEnd = workEnd.trim()
    const normalizedDuration = Number(durationMin)

    if (!normalizedDoctorId) {
      setFormError('Выберите врача')
      return null
    }

    if (!normalizedDateFrom || !normalizedDateTo) {
      setFormError('Укажите диапазон дат')
      return null
    }

    if (Date.parse(`${normalizedDateFrom}T00:00:00`) > Date.parse(`${normalizedDateTo}T00:00:00`)) {
      setFormError('Дата начала не может быть позже даты окончания')
      return null
    }

    if (!normalizedWorkStart || !normalizedWorkEnd) {
      setFormError('Укажите рабочие часы')
      return null
    }

    if (Date.parse(`2000-01-01T${normalizedWorkStart}:00`) >= Date.parse(`2000-01-01T${normalizedWorkEnd}:00`)) {
      setFormError('Время начала должно быть раньше времени окончания')
      return null
    }

    if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0) {
      setFormError('Длительность слота должна быть положительным целым числом')
      return null
    }

    if (Date.parse(`${normalizedDateFrom}T${normalizedWorkStart}:00`) < Date.now()) {
      setFormError('Нельзя сгенерировать слоты в прошлом')
      return null
    }

    setFormError(null)
    return {
      doctorId: normalizedDoctorId,
      dateFrom: normalizedDateFrom,
      dateTo: normalizedDateTo,
      workStart: normalizedWorkStart,
      workEnd: normalizedWorkEnd,
      durationMin: normalizedDuration,
    }
  }, [dateFrom, dateTo, doctorId, durationMin, workEnd, workStart])

  const handleGenerate = useCallback(
    async (payloadOverride?: GenerateSlotsPayload) => {
      const payload = payloadOverride ?? validateGenerationForm()
      if (!payload) {
        return
      }

      setIsGenerating(true)
      setMutationError(null)
      setGenerationSummary(null)
      setLastPayload(payload)

      try {
        const result = await generateSlotsBulk(payload)
        const refreshedSlots = await getAllSlots()
        setSlots(refreshedSlots)
        setSlotActionError(null)
        setGenerationSummary(
          `Сгенерировано слотов: ${result.created.length}. Пропущено пересечений: ${result.skipped}.`,
        )
      } catch (mutationLoadError) {
        setMutationError(
          mutationLoadError instanceof Error
            ? mutationLoadError.message
            : 'Не удалось сгенерировать слоты',
        )
      } finally {
        setIsGenerating(false)
      }
    },
    [validateGenerationForm],
  )

  const handleRetryGenerate = useCallback(() => {
    if (!lastPayload) {
      return
    }

    void handleGenerate(lastPayload)
  }, [handleGenerate, lastPayload])

  const handleToggleSlotStatus = useCallback(async (slotId: string, nextStatus: SlotStatus) => {
    setUpdatingSlotId(slotId)
    setSlotActionError(null)
    setLastSlotAction({ slotId, status: nextStatus })

    try {
      const updatedSlot = await updateSlotStatus(slotId, nextStatus)
      setSlots((currentSlots) =>
        currentSlots.map((slot) => (slot.id === updatedSlot.id ? updatedSlot : slot)),
      )
    } catch (updateError) {
      setSlotActionError(
        updateError instanceof Error ? updateError.message : 'Не удалось изменить статус слота',
      )
    } finally {
      setUpdatingSlotId(null)
    }
  }, [])

  const handleRetrySlotAction = useCallback(() => {
    if (!lastSlotAction) {
      return
    }

    void handleToggleSlotStatus(lastSlotAction.slotId, lastSlotAction.status)
  }, [handleToggleSlotStatus, lastSlotAction])

  const slotsSummary = useMemo(() => {
    return slots.reduce(
      (summary, slot) => {
        if (slot.status === 'booked') {
          summary.booked += 1
        } else if (slot.status === 'held') {
          summary.held += 1
        } else if (slot.status === 'blocked') {
          summary.blocked += 1
        } else {
          summary.free += 1
        }
        return summary
      },
      { free: 0, held: 0, booked: 0, blocked: 0 },
    )
  }, [slots])

  const latestSlots = useMemo(() => {
    return [...slots]
      .sort((left, right) => Date.parse(left.startAtISO) - Date.parse(right.startAtISO))
      .slice(0, 20)
  }, [slots])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Администрирование слотов</h2>
      <Card title="Управление расписанием" description="Мониторинг занятости и доступности слотов">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="danger">Только для администратора</Badge>
          <Badge variant="success">Свободно: {slotsSummary.free}</Badge>
          <Badge variant="warning">На удержании: {slotsSummary.held}</Badge>
          <Badge variant="warning">Заблокировано: {slotsSummary.blocked}</Badge>
          <Badge variant="default">Занято: {slotsSummary.booked}</Badge>
        </div>
      </Card>

      {status === 'loading' && <LoadingSlots />}

      {status === 'failed' && (
        <Card title="Не удалось загрузить слоты" description={error ?? 'Повторите попытку позже'}>
          <Button onClick={handleRetry}>Повторить</Button>
        </Card>
      )}

      {status === 'succeeded' && (
        <>
          <Card
            title="Генерация слотов"
            description="Создаёт новые свободные слоты для выбранного врача в диапазоне дат."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">Врач</span>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  value={doctorId}
                  onChange={(event) => {
                    setDoctorId(event.currentTarget.value)
                  }}
                >
                  <option value="" disabled>
                    Выберите врача
                  </option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <Input
                label="Длительность слота (мин)"
                type="number"
                min={1}
                step={1}
                value={durationMin}
                onChange={(event) => {
                  setDurationMin(event.currentTarget.value)
                }}
              />

              <Input
                label="Дата начала"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.currentTarget.value)
                }}
              />

              <Input
                label="Дата окончания"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.currentTarget.value)
                }}
              />

              <Input
                label="Начало рабочего дня"
                type="time"
                value={workStart}
                onChange={(event) => {
                  setWorkStart(event.currentTarget.value)
                }}
              />

              <Input
                label="Конец рабочего дня"
                type="time"
                value={workEnd}
                onChange={(event) => {
                  setWorkEnd(event.currentTarget.value)
                }}
              />
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            {mutationError && <p className="mt-3 text-sm text-red-600">{mutationError}</p>}
            {generationSummary && <p className="mt-3 text-sm text-emerald-700">{generationSummary}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  void handleGenerate()
                }}
                disabled={isGenerating || doctors.length === 0}
              >
                {isGenerating ? 'Генерируем...' : 'Сгенерировать'}
              </Button>
              {mutationError && lastPayload && (
                <Button
                  variant="secondary"
                  onClick={handleRetryGenerate}
                  disabled={isGenerating || updatingSlotId !== null}
                >
                  Повторить генерацию
                </Button>
              )}
            </div>
          </Card>

          <Card
            title="Ближайшие слоты"
            description="Показаны первые 20 ближайших слотов по дате и времени."
          >
            {slotActionError && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-red-600">{slotActionError}</p>
                {lastSlotAction && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRetrySlotAction}
                    disabled={updatingSlotId !== null}
                  >
                    Повторить изменение
                  </Button>
                )}
              </div>
            )}

            {latestSlots.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {latestSlots.map((slot) => (
                  <article
                    key={slot.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(slot.startAtISO).toLocaleString('ru-RU')}
                      </p>
                      <p className="text-xs text-slate-500">
                        Врач: {slot.doctorId} · Slot ID: {slot.id}
                      </p>
                    </div>
                    <Badge
                      variant={
                        slot.status === 'booked'
                          ? 'danger'
                          : slot.status === 'held'
                            ? 'warning'
                            : slot.status === 'blocked'
                              ? 'warning'
                              : 'success'
                      }
                    >
                      {slot.status === 'booked'
                        ? 'Занят'
                        : slot.status === 'held'
                          ? 'Удержание'
                          : slot.status === 'blocked'
                            ? 'Заблокирован'
                            : 'Свободен'}
                    </Badge>
                    {slot.status === 'free' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isGenerating || updatingSlotId !== null}
                        onClick={() => {
                          void handleToggleSlotStatus(slot.id, 'blocked')
                        }}
                      >
                        {updatingSlotId === slot.id ? 'Сохраняем...' : 'Заблокировать'}
                      </Button>
                    )}
                    {slot.status === 'blocked' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isGenerating || updatingSlotId !== null}
                        onClick={() => {
                          void handleToggleSlotStatus(slot.id, 'free')
                        }}
                      >
                        {updatingSlotId === slot.id ? 'Сохраняем...' : 'Разблокировать'}
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Слоты не найдены.</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default AdminSlotsPage
