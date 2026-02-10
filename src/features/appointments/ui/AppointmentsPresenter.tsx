import type { AppointmentListItem } from '@/features/appointments/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'

export interface AppointmentsPresenterProps {
  appointments: AppointmentListItem[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  cancelStatusById: Record<string, 'idle' | 'loading' | 'failed'>
  cancelErrorById: Record<string, string | null>
  onRetry: () => void
  onCancel: (appointment: AppointmentListItem) => void
  onRetryCancel: (appointment: AppointmentListItem) => void
  onReschedule: (appointment: AppointmentListItem) => void
}

function LoadingAppointments() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`appointment-loading-${index}`} className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-60" />
        </Card>
      ))}
    </div>
  )
}

function formatAppointmentType(type: AppointmentListItem['appointmentType']): string {
  return type === 'online' ? 'Онлайн' : 'Оффлайн'
}

function formatAppointmentStatus(status: AppointmentListItem['status']): string {
  if (status === 'cancelled') {
    return 'Отменено'
  }
  if (status === 'completed') {
    return 'Завершено'
  }

  return 'Запланировано'
}

function getAppointmentStatusVariant(
  status: AppointmentListItem['status'],
): 'default' | 'success' | 'warning' {
  if (status === 'cancelled') {
    return 'warning'
  }
  if (status === 'completed') {
    return 'default'
  }

  return 'success'
}

export function AppointmentsPresenter({
  appointments,
  status,
  error,
  cancelStatusById,
  cancelErrorById,
  onRetry,
  onCancel,
  onRetryCancel,
  onReschedule,
}: AppointmentsPresenterProps) {
  const isLoading = status === 'loading'
  const isFailed = status === 'failed'

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Мои записи</h2>

      {isLoading && <LoadingAppointments />}

      {isFailed && (
        <Card title="Не удалось загрузить записи" description={error ?? 'Повторите попытку позже'}>
          <Button onClick={onRetry}>Повторить</Button>
        </Card>
      )}

      {!isLoading && !isFailed && (
        <>
          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  title={appointment.doctorName}
                  description={new Date(appointment.startAtISO).toLocaleString('ru-RU')}
                >
                  <div className="mb-2">
                    <Badge variant={getAppointmentStatusVariant(appointment.status)}>
                      {formatAppointmentStatus(appointment.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Тип приема: {formatAppointmentType(appointment.appointmentType)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{appointment.reason}</p>
                  {appointment.status === 'scheduled' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onReschedule(appointment)
                        }}
                      >
                        Перенести
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={cancelStatusById[appointment.id] === 'loading'}
                        onClick={() => {
                          onCancel(appointment)
                        }}
                      >
                        {cancelStatusById[appointment.id] === 'loading'
                          ? 'Отменяем...'
                          : 'Отменить запись'}
                      </Button>
                      {cancelErrorById[appointment.id] && (
                        <>
                          <p className="text-sm text-red-600">{cancelErrorById[appointment.id]}</p>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              onRetryCancel(appointment)
                            }}
                          >
                            Повторить отмену
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card
              title="Записей пока нет"
              description="После подтверждения записи она появится в этом разделе."
            />
          )}
        </>
      )}
    </div>
  )
}
