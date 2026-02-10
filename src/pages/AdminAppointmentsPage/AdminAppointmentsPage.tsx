import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAppointments, updateAppointmentStatus } from '@/entities/appointment/api'
import type { Appointment, AppointmentStatus } from '@/entities/appointment/model/types'
import { getDoctors } from '@/entities/doctor/api'
import type { Doctor } from '@/entities/doctor/model/types'
import { getAllSlots, updateSlotStatus } from '@/entities/slot/api'
import type { Slot } from '@/entities/slot/model/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

interface LastAction {
  appointmentId: string
  slotId: string
  status: AppointmentStatus
}

function LoadingAppointments() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`admin-appointments-loading-${index}`} className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-48" />
        </Card>
      ))}
    </div>
  )
}

function getStatusLabel(status: AppointmentStatus): string {
  if (status === 'cancelled') {
    return 'Отменено'
  }
  if (status === 'completed') {
    return 'Завершено'
  }

  return 'Запланировано'
}

function getStatusVariant(status: AppointmentStatus): 'success' | 'warning' | 'default' {
  if (status === 'scheduled') {
    return 'success'
  }
  if (status === 'cancelled') {
    return 'warning'
  }

  return 'default'
}

function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [doctorFilter, setDoctorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('')
  const [dateFilter, setDateFilter] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)

  const loadPageData = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const [appointmentsData, doctorsData, slotsData] = await Promise.all([
        getAppointments(),
        getDoctors(),
        getAllSlots(),
      ])

      setAppointments(appointmentsData)
      setDoctors(doctorsData)
      setSlots(slotsData)
      setStatus('succeeded')
      setError(null)
    } catch (loadError) {
      setStatus('failed')
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить записи')
    }
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const doctorById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor.fullName])),
    [doctors],
  )

  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots])

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => {
        if (doctorFilter && appointment.doctorId !== doctorFilter) {
          return false
        }

        if (statusFilter && appointment.status !== statusFilter) {
          return false
        }

        if (dateFilter) {
          const slot = slotById.get(appointment.slotId)
          if (!slot || slot.startAtISO.slice(0, 10) !== dateFilter) {
            return false
          }
        }

        return true
      })
      .sort((left, right) => {
        const leftSlot = slotById.get(left.slotId)
        const rightSlot = slotById.get(right.slotId)

        const leftTime = leftSlot ? Date.parse(leftSlot.startAtISO) : Number.POSITIVE_INFINITY
        const rightTime = rightSlot ? Date.parse(rightSlot.startAtISO) : Number.POSITIVE_INFINITY

        return leftTime - rightTime
      })
  }, [appointments, dateFilter, doctorFilter, slotById, statusFilter])

  const statusCounters = useMemo(() => {
    return appointments.reduce(
      (accumulator, appointment) => {
        if (appointment.status === 'scheduled') {
          accumulator.scheduled += 1
        } else if (appointment.status === 'cancelled') {
          accumulator.cancelled += 1
        } else {
          accumulator.completed += 1
        }

        return accumulator
      },
      { scheduled: 0, cancelled: 0, completed: 0 },
    )
  }, [appointments])

  const updateStatus = useCallback(async (action: LastAction) => {
    setUpdatingAppointmentId(action.appointmentId)
    setMutationError(null)
    setLastAction(action)

    try {
      const updatedAppointment = await updateAppointmentStatus(action.appointmentId, action.status)

      if (action.status === 'cancelled') {
        await updateSlotStatus(action.slotId, 'free')
        setSlots((currentSlots) =>
          currentSlots.map((slot) =>
            slot.id === action.slotId
              ? {
                  ...slot,
                  status: 'free',
                }
              : slot,
          ),
        )
      }

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === updatedAppointment.id ? updatedAppointment : appointment,
        ),
      )
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось обновить статус записи',
      )
    } finally {
      setUpdatingAppointmentId(null)
    }
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Администрирование записей</h2>

      <Card title="Контроль статусов" description="Мониторинг и обновление статусов записей пациентов">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Запланировано: {statusCounters.scheduled}</Badge>
          <Badge variant="warning">Отменено: {statusCounters.cancelled}</Badge>
          <Badge variant="default">Завершено: {statusCounters.completed}</Badge>
        </div>
      </Card>

      {status === 'loading' && <LoadingAppointments />}

      {status === 'failed' && (
        <Card title="Не удалось загрузить записи" description={error ?? 'Повторите попытку позже'}>
          <Button
            onClick={() => {
              void loadPageData()
            }}
          >
            Повторить
          </Button>
        </Card>
      )}

      {status === 'succeeded' && (
        <>
          <Card title="Фильтры" description="Фильтрация по врачу, дате и статусу">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">Врач</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  value={doctorFilter}
                  onChange={(event) => {
                    setDoctorFilter(event.currentTarget.value)
                  }}
                >
                  <option value="">Все врачи</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">Статус</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  value={statusFilter}
                  onChange={(event) => {
                    const value = event.currentTarget.value as AppointmentStatus | ''
                    setStatusFilter(value)
                  }}
                >
                  <option value="">Все статусы</option>
                  <option value="scheduled">Запланировано</option>
                  <option value="cancelled">Отменено</option>
                  <option value="completed">Завершено</option>
                </select>
              </label>

              <Input
                label="Дата"
                type="date"
                value={dateFilter}
                onChange={(event) => {
                  setDateFilter(event.currentTarget.value)
                }}
              />
            </div>
          </Card>

          <Card title="Список записей" description="Управление жизненным циклом appointments">
            {mutationError && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-red-600">{mutationError}</p>
                {lastAction && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updatingAppointmentId !== null}
                    onClick={() => {
                      void updateStatus(lastAction)
                    }}
                  >
                    Повторить
                  </Button>
                )}
              </div>
            )}

            {filteredAppointments.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {filteredAppointments.map((appointment) => {
                  const slot = slotById.get(appointment.slotId)
                  const dateLabel = slot
                    ? new Date(slot.startAtISO).toLocaleString('ru-RU')
                    : 'Дата не найдена'

                  return (
                    <article key={appointment.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {doctorById.get(appointment.doctorId) ?? appointment.doctorId}
                        </h3>
                        <Badge variant={getStatusVariant(appointment.status)}>
                          {getStatusLabel(appointment.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{dateLabel}</p>
                      <p className="text-xs text-slate-500">
                        Пациент: {appointment.userId} · Тип: {appointment.appointmentType}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{appointment.reason}</p>

                      {appointment.status === 'scheduled' && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingAppointmentId !== null}
                            onClick={() => {
                              void updateStatus({
                                appointmentId: appointment.id,
                                slotId: appointment.slotId,
                                status: 'completed',
                              })
                            }}
                          >
                            {updatingAppointmentId === appointment.id
                              ? 'Сохраняем...'
                              : 'Отметить завершенной'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updatingAppointmentId !== null}
                            onClick={() => {
                              void updateStatus({
                                appointmentId: appointment.id,
                                slotId: appointment.slotId,
                                status: 'cancelled',
                              })
                            }}
                          >
                            {updatingAppointmentId === appointment.id
                              ? 'Сохраняем...'
                              : 'Отменить'}
                          </Button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Записи по текущим фильтрам не найдены.</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default AdminAppointmentsPage
