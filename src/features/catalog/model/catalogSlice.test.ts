import { describe, expect, it } from 'vitest'
import type { RootState } from '@/app/store'
import type { Doctor } from '@/entities/doctor/model/types'
import type { Service } from '@/entities/service/model/types'
import {
  catalogReducer,
  fetchCatalogData,
  selectCatalogError,
  selectCatalogSearch,
  selectCatalogStatus,
  selectDoctors,
  selectFilteredDoctors,
  selectSelectedServiceId,
  selectServices,
  setSearch,
  setSelectedServiceId,
} from './catalogSlice'

const serviceFixtures: Service[] = [
  { id: 'service-therapist', name: 'Консультация терапевта', durationMin: 30, priceKzt: 9000 },
  { id: 'service-cardiology', name: 'Консультация кардиолога', durationMin: 40, priceKzt: 12000 },
]

const doctorFixtures: Doctor[] = [
  {
    id: 'doctor-1',
    fullName: 'Иванова Мария Сергеевна',
    specialty: 'Терапевт',
    rating: 4.9,
    clinicName: 'Клиника "Здоровье+"',
    serviceIds: ['service-therapist'],
  },
  {
    id: 'doctor-2',
    fullName: 'Петров Алексей Викторович',
    specialty: 'Кардиолог',
    rating: 4.8,
    clinicName: 'Медцентр "Cardio Life"',
    serviceIds: ['service-cardiology'],
  },
]

describe('catalogSlice', () => {
  it('обрабатывает pending/fulfilled/rejected для fetchCatalogData', () => {
    const pendingState = catalogReducer(undefined, fetchCatalogData.pending('req-1', undefined))
    expect(pendingState.status).toBe('loading')
    expect(pendingState.error).toBeNull()

    const fulfilledState = catalogReducer(
      pendingState,
      fetchCatalogData.fulfilled(
        { services: serviceFixtures, doctors: doctorFixtures },
        'req-1',
        undefined,
      ),
    )
    expect(fulfilledState.status).toBe('succeeded')
    expect(fulfilledState.services).toEqual(serviceFixtures)
    expect(fulfilledState.doctors).toEqual(doctorFixtures)

    const rejectedState = catalogReducer(
      fulfilledState,
      fetchCatalogData.rejected(
        new Error('boom'),
        'req-2',
        undefined,
        'Не удалось загрузить данные каталога',
      ),
    )
    expect(rejectedState.status).toBe('failed')
    expect(rejectedState.error).toBe('Не удалось загрузить данные каталога')
  })

  it('обрабатывает фильтры через reducers и selectors', () => {
    const loadedState = catalogReducer(
      undefined,
      fetchCatalogData.fulfilled(
        { services: serviceFixtures, doctors: doctorFixtures },
        'req-1',
        undefined,
      ),
    )
    const selectedState = catalogReducer(
      catalogReducer(loadedState, setSelectedServiceId('service-therapist')),
      setSearch('иван'),
    )

    const rootState = {
      catalog: selectedState,
    } as RootState

    expect(selectCatalogStatus(rootState)).toBe('succeeded')
    expect(selectCatalogError(rootState)).toBeNull()
    expect(selectServices(rootState)).toHaveLength(2)
    expect(selectDoctors(rootState)).toHaveLength(2)
    expect(selectSelectedServiceId(rootState)).toBe('service-therapist')
    expect(selectCatalogSearch(rootState)).toBe('иван')
    expect(selectFilteredDoctors(rootState)).toEqual([doctorFixtures[0]])
  })
})

