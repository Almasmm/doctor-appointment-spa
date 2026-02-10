import { useCallback, useEffect, useMemo, useState } from 'react'
import { createService, deleteService, getServices, updateService } from '@/entities/service/api'
import type { Service } from '@/entities/service/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

function LoadingServices() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`admin-service-loading-${index}`} className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-48" />
        </Card>
      ))}
    </div>
  )
}

function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)

  const requestServices = useCallback(() => getServices(), [])

  const loadServices = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const data = await requestServices()
      setServices(data)
      setError(null)
      setStatus('succeeded')
    } catch (loadError) {
      setStatus('failed')
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить список услуг')
    }
  }, [requestServices])

  useEffect(() => {
    void loadServices()
  }, [loadServices])

  const handleRetry = useCallback(() => {
    void loadServices()
  }, [loadServices])

  const editingService = useMemo(
    () => services.find((service) => service.id === editingServiceId) ?? null,
    [editingServiceId, services],
  )

  function resetForm(): void {
    setFormName('')
    setFormDuration('')
    setFormPrice('')
    setEditingServiceId(null)
    setFormError(null)
    setMutationError(null)
  }

  function validateForm(): { name: string; durationMin: number; priceKzt: number } | null {
    const normalizedName = formName.trim()
    if (!normalizedName) {
      setFormError('Название услуги обязательно')
      return null
    }

    const duration = Number(formDuration)
    if (!Number.isInteger(duration) || duration <= 0) {
      setFormError('Длительность должна быть положительным целым числом')
      return null
    }

    const price = Number(formPrice)
    if (!Number.isInteger(price) || price < 0) {
      setFormError('Стоимость должна быть неотрицательным целым числом')
      return null
    }

    const hasNameConflict = services.some(
      (service) =>
        service.id !== editingServiceId &&
        service.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    )

    if (hasNameConflict) {
      setFormError('Услуга с таким названием уже существует')
      return null
    }

    setFormError(null)
    return {
      name: normalizedName,
      durationMin: duration,
      priceKzt: price,
    }
  }

  async function handleSubmitService(): Promise<void> {
    const validated = validateForm()
    if (!validated) {
      return
    }

    setIsSaving(true)
    setMutationError(null)

    try {
      if (editingServiceId) {
        const updated = await updateService(editingServiceId, validated)
        setServices((prev) =>
          prev.map((service) => (service.id === updated.id ? updated : service)),
        )
      } else {
        const created = await createService(validated)
        setServices((prev) => [...prev, created])
      }

      resetForm()
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : 'Не удалось сохранить услугу',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteService(serviceId: string): Promise<void> {
    setDeletingServiceId(serviceId)
    setMutationError(null)

    try {
      await deleteService(serviceId)
      setServices((prev) => prev.filter((service) => service.id !== serviceId))
      if (editingServiceId === serviceId) {
        resetForm()
      }
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : 'Не удалось удалить услугу',
      )
    } finally {
      setDeletingServiceId(null)
    }
  }

  function handleStartEdit(service: Service): void {
    setEditingServiceId(service.id)
    setFormName(service.name)
    setFormDuration(String(service.durationMin))
    setFormPrice(String(service.priceKzt))
    setFormError(null)
    setMutationError(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Администрирование услуг</h2>
      <Card
        title="Управление услугами"
        description="Каталог медицинских услуг с длительностью и стоимостью"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="danger">Только для администратора</Badge>
          <Badge variant="default">Всего услуг: {services.length}</Badge>
        </div>
      </Card>

      {status === 'loading' && <LoadingServices />}

      {status === 'failed' && (
        <Card title="Не удалось загрузить услуги" description={error ?? 'Повторите попытку позже'}>
          <Button onClick={handleRetry}>Повторить</Button>
        </Card>
      )}

      {status === 'succeeded' && (
        <>
          <Card
            title={editingService ? 'Редактирование услуги' : 'Новая услуга'}
            description={
              editingService
                ? `Изменение услуги: ${editingService.name}`
                : 'Добавьте новую услугу в каталог'
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Название"
                value={formName}
                onChange={(event) => {
                  setFormName(event.currentTarget.value)
                }}
                placeholder="Название услуги"
              />
              <Input
                label="Длительность (мин)"
                type="number"
                min={1}
                value={formDuration}
                onChange={(event) => {
                  setFormDuration(event.currentTarget.value)
                }}
                placeholder="30"
              />
              <Input
                label="Стоимость (₸)"
                type="number"
                min={0}
                value={formPrice}
                onChange={(event) => {
                  setFormPrice(event.currentTarget.value)
                }}
                placeholder="9000"
              />
            </div>

            {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
            {mutationError && <p className="mt-2 text-sm text-red-600">{mutationError}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleSubmitService} disabled={isSaving}>
                {isSaving
                  ? 'Сохраняем...'
                  : editingService
                    ? 'Сохранить изменения'
                    : 'Добавить услугу'}
              </Button>
              {editingService && (
                <Button variant="secondary" onClick={resetForm} disabled={isSaving}>
                  Отмена
                </Button>
              )}
            </div>
          </Card>

          <Card>
            {services.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {services.map((service) => (
                  <article key={service.id} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                    <p className="text-sm text-slate-600">
                      Длительность: {service.durationMin} мин · Стоимость: {service.priceKzt} ₸
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          handleStartEdit(service)
                        }}
                        disabled={isSaving || deletingServiceId === service.id}
                      >
                        Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void handleDeleteService(service.id)
                        }}
                        disabled={isSaving || deletingServiceId === service.id}
                      >
                        {deletingServiceId === service.id ? 'Удаляем...' : 'Удалить'}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Список услуг пуст.</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default AdminServicesPage
