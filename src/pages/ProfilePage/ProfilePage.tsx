import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { fetchMyAppointments, selectAppointmentsStatus, selectMyAppointments } from '@/features/appointments/model'
import { selectUser } from '@/features/auth/model'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'

function ProfilePage() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const appointments = useAppSelector(selectMyAppointments)
  const appointmentsStatus = useAppSelector(selectAppointmentsStatus)
  const [referenceNowISO] = useState(() => new Date().toISOString())

  useEffect(() => {
    if (!user) {
      return
    }

    void dispatch(fetchMyAppointments(user.id))
  }, [dispatch, user])

  const scheduledAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'scheduled'),
    [appointments],
  )

  const nearestAppointment = useMemo(() => {
    const now = Date.parse(referenceNowISO)
    const futureAppointments = scheduledAppointments
      .filter((appointment) => Date.parse(appointment.startAtISO) >= now)
      .sort((left, right) => Date.parse(left.startAtISO) - Date.parse(right.startAtISO))

    return futureAppointments[0] ?? null
  }, [referenceNowISO, scheduledAppointments])

  const roleLabel = user?.role === 'admin' ? 'Администратор' : 'Пациент'

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Профиль пользователя</h2>

      <Card title={user?.fullName ?? 'Пользователь'} description={user?.email}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{roleLabel}</Badge>
          <Badge variant="success">Записей: {scheduledAppointments.length}</Badge>
        </div>
      </Card>

      <Card title="Ближайшая запись" description="Актуальная информация по следующему визиту">
        {appointmentsStatus === 'loading' && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        )}

        {appointmentsStatus !== 'loading' && nearestAppointment && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{nearestAppointment.doctorName}</p>
            <p className="text-sm text-slate-600">
              {new Date(nearestAppointment.startAtISO).toLocaleString('ru-RU')}
            </p>
            <p className="text-sm text-slate-500">Тип приема: {nearestAppointment.appointmentType}</p>
          </div>
        )}

        {appointmentsStatus !== 'loading' && !nearestAppointment && (
          <p className="text-sm text-slate-500">
            У вас пока нет предстоящих записей. Откройте каталог, чтобы выбрать врача.
          </p>
        )}
      </Card>
    </div>
  )
}

export default ProfilePage
