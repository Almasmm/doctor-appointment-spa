import type { Doctor } from '@/entities/doctor/model/types'
import { http } from '@/shared/lib/http'

export async function getDoctors(): Promise<Doctor[]> {
  return http<Doctor[]>('/doctors')
}

export async function getDoctorById(id: string): Promise<Doctor> {
  return http<Doctor>(`/doctors/${id}`)
}

type CreateDoctorPayload = Doctor
type UpdateDoctorPayload = Partial<
  Pick<Doctor, 'fullName' | 'specialty' | 'rating' | 'clinicName' | 'serviceIds'>
>

export async function createDoctor(payload: CreateDoctorPayload): Promise<Doctor> {
  return http<Doctor>('/doctors', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDoctor(doctorId: string, payload: UpdateDoctorPayload): Promise<Doctor> {
  return http<Doctor>(`/doctors/${doctorId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDoctor(doctorId: string): Promise<void> {
  await http<Record<string, never>>(`/doctors/${doctorId}`, {
    method: 'DELETE',
  })
}
