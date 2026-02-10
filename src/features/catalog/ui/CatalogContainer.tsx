import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  fetchCatalogData,
  filterCatalogDoctors,
  selectCatalogError,
  selectCatalogSearch,
  selectCatalogStatus,
  selectDoctors,
  selectSelectedServiceId,
  selectServices,
  setSearch,
  setSelectedServiceId,
} from '@/features/catalog/model'
import { CatalogPresenter } from './CatalogPresenter'

export function CatalogContainer() {
  const dispatch = useAppDispatch()
  const services = useAppSelector(selectServices)
  const doctors = useAppSelector(selectDoctors)
  const selectedServiceId = useAppSelector(selectSelectedServiceId)
  const search = useAppSelector(selectCatalogSearch)
  const status = useAppSelector(selectCatalogStatus)
  const error = useAppSelector(selectCatalogError)

  const filteredDoctors = useMemo(
    () => filterCatalogDoctors(doctors, selectedServiceId, search),
    [doctors, selectedServiceId, search],
  )

  useEffect(() => {
    void dispatch(fetchCatalogData())
  }, [dispatch])

  const handleRetry = useCallback(() => {
    void dispatch(fetchCatalogData())
  }, [dispatch])

  const handleServiceChange = useCallback(
    (value: string | null) => {
      dispatch(setSelectedServiceId(value))
    },
    [dispatch],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      dispatch(setSearch(value))
    },
    [dispatch],
  )

  return (
    <CatalogPresenter
      services={services}
      filteredDoctors={filteredDoctors}
      selectedServiceId={selectedServiceId}
      search={search}
      status={status}
      error={error}
      onRetry={handleRetry}
      onServiceChange={handleServiceChange}
      onSearchChange={handleSearchChange}
    />
  )
}
