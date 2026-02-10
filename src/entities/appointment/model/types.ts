export type AppointmentType = 'online' | 'offline'
export type AppointmentStatus = 'scheduled' | 'cancelled' | 'completed'

export interface Appointment {
  id: string
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
