import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { selectUser } from '@/features/auth/model'
import {
  cancelMyAppointment,
  fetchMyAppointments,
  selectAppointmentsError,
  selectAppointmentsStatus,
  selectMyAppointments,
} from '@/features/appointments/model'
import type { AppointmentListItem } from '@/features/appointments/model'
import { AppointmentsPresenter } from './AppointmentsPresenter'

export function AppointmentsContainer() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const appointments = useAppSelector(selectMyAppointments)
  const status = useAppSelector(selectAppointmentsStatus)
  const error = useAppSelector(selectAppointmentsError)
  const cancelStatusById = useAppSelector((state) => state.appointments.cancelStatusById)
  const cancelErrorById = useAppSelector((state) => state.appointments.cancelErrorById)

  const loadAppointments = useCallback(() => {
    if (!user) {
      return
    }

    void dispatch(fetchMyAppointments(user.id))
  }, [dispatch, user])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  const cancelAppointment = useCallback(
    (appointment: AppointmentListItem) => {
      const accepted = window.confirm('Отменить выбранную запись?')
      if (!accepted) {
        return
      }

      void dispatch(
        cancelMyAppointment({
          appointmentId: appointment.id,
          slotId: appointment.slotId,
        }),
      )
    },
    [dispatch],
  )

  const retryCancelAppointment = useCallback(
    (appointment: AppointmentListItem) => {
      void dispatch(
        cancelMyAppointment({
          appointmentId: appointment.id,
          slotId: appointment.slotId,
        }),
      )
    },
    [dispatch],
  )

  const rescheduleAppointment = useCallback(
    (appointment: AppointmentListItem) => {
      const query = new URLSearchParams({
        rescheduleAppointmentId: appointment.id,
        previousSlotId: appointment.slotId,
      })

      navigate(`/app/booking/${appointment.doctorId}?${query.toString()}`)
    },
    [navigate],
  )

  return (
    <AppointmentsPresenter
      appointments={appointments}
      status={status}
      error={error}
      cancelStatusById={cancelStatusById}
      cancelErrorById={cancelErrorById}
      onRetry={loadAppointments}
      onCancel={cancelAppointment}
      onRetryCancel={retryCancelAppointment}
      onReschedule={rescheduleAppointment}
    />
  )
}
