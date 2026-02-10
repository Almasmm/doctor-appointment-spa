import { http } from '@/shared/lib/http'
import type { Service } from '@/entities/service/model/types'

export async function getServices(): Promise<Service[]> {
  return http<Service[]>('/services')
}

type CreateServicePayload = Omit<Service, 'id'> & { id?: string }
type UpdateServicePayload = Partial<Pick<Service, 'name' | 'durationMin' | 'priceKzt'>>

export async function createService(payload: CreateServicePayload): Promise<Service> {
  return http<Service>('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateService(
  serviceId: string,
  payload: UpdateServicePayload,
): Promise<Service> {
  return http<Service>(`/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteService(serviceId: string): Promise<void> {
  await http<Record<string, never>>(`/services/${serviceId}`, {
    method: 'DELETE',
  })
}
