import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from '@/entities/appointment/model/types'
import { http } from '@/shared/lib/http'

export interface CreateAppointmentPayload {
  userId: string
  doctorId: string
  slotId: string
  serviceId: string
  appointmentType: AppointmentType
  status: AppointmentStatus
  reason: string
  contactEmail?: string
  contactPhone?: string
  createdAtISO: string
}

export interface GetAppointmentsParams {
  userId?: string
  doctorId?: string
  status?: AppointmentStatus
}

export async function createAppointment(
  payload: CreateAppointmentPayload,
): Promise<Appointment> {
  return http<Appointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getAppointmentsByUser(userId: string): Promise<Appointment[]> {
  const query = new URLSearchParams({ userId })
  return http<Appointment[]>(`/appointments?${query.toString()}`)
}

export async function getAppointments(params: GetAppointmentsParams = {}): Promise<Appointment[]> {
  const query = new URLSearchParams()
  if (params.userId) {
    query.set('userId', params.userId)
  }
  if (params.doctorId) {
    query.set('doctorId', params.doctorId)
  }
  if (params.status) {
    query.set('status', params.status)
  }

  const queryString = query.toString()
  if (queryString) {
    return http<Appointment[]>(`/appointments?${queryString}`)
  }

  return http<Appointment[]>('/appointments')
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  return http<Appointment>(`/appointments/${appointmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function updateAppointment(
  appointmentId: string,
  payload: Partial<
    Pick<
      Appointment,
      | 'slotId'
      | 'serviceId'
      | 'appointmentType'
      | 'reason'
      | 'contactEmail'
      | 'contactPhone'
      | 'status'
    >
  >,
): Promise<Appointment> {
  return http<Appointment>(`/appointments/${appointmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
