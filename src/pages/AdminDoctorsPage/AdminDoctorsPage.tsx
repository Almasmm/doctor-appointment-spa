import { useCallback, useEffect, useMemo, useState } from 'react'
import { createDoctor, deleteDoctor, getDoctors, updateDoctor } from '@/entities/doctor/api'
import type { Doctor } from '@/entities/doctor/model'
import { getServices } from '@/entities/service/api'
import type { Service } from '@/entities/service/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

function LoadingDoctors() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`admin-doctor-loading-${index}`} className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-40" />
        </Card>
      ))}
    </div>
  )
}

function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [formId, setFormId] = useState('')
  const [formFullName, setFormFullName] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')
  const [formClinicName, setFormClinicName] = useState('')
  const [formRating, setFormRating] = useState('4.5')
  const [formServiceIds, setFormServiceIds] = useState<string[]>([])
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingDoctorId, setDeletingDoctorId] = useState<string | null>(null)

  const loadDoctors = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const [doctorsData, servicesData] = await Promise.all([getDoctors(), getServices()])
      setDoctors(doctorsData)
      setServices(servicesData)
      setError(null)
      setStatus('succeeded')
    } catch (loadError) {
      setStatus('failed')
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить список врачей')
    }
  }, [])

  useEffect(() => {
    void loadDoctors()
  }, [loadDoctors])

  const handleRetry = useCallback(() => {
    void loadDoctors()
  }, [loadDoctors])

  const editingDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === editingDoctorId) ?? null,
    [doctors, editingDoctorId],
  )

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service.name])),
    [services],
  )

  function resetForm(): void {
    setFormId('')
    setFormFullName('')
    setFormSpecialty('')
    setFormClinicName('')
    setFormRating('4.5')
    setFormServiceIds([])
    setEditingDoctorId(null)
    setFormError(null)
    setMutationError(null)
  }

  function validateForm():
    | {
        id: string
        fullName: string
        specialty: string
        clinicName: string
        rating: number
        serviceIds: string[]
      }
    | null {
    const normalizedId = formId.trim()
    const normalizedFullName = formFullName.trim()
    const normalizedSpecialty = formSpecialty.trim()
    const normalizedClinicName = formClinicName.trim()
    const rating = Number(formRating)

    if (!editingDoctorId && !normalizedId) {
      setFormError('ID врача обязателен')
      return null
    }

    if (!editingDoctorId && doctors.some((doctor) => doctor.id === normalizedId)) {
      setFormError('Врач с таким ID уже существует')
      return null
    }

    if (!normalizedFullName) {
      setFormError('ФИО врача обязательно')
      return null
    }

    if (!normalizedSpecialty) {
      setFormError('Специализация обязательна')
      return null
    }

    if (!normalizedClinicName) {
      setFormError('Название клиники обязательно')
      return null
    }

    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      setFormError('Рейтинг должен быть в диапазоне от 0 до 5')
      return null
    }

    if (formServiceIds.length === 0) {
      setFormError('Выберите хотя бы одну услугу')
      return null
    }

    const hasUnknownService = formServiceIds.some((serviceId) => !serviceById.has(serviceId))
    if (hasUnknownService) {
      setFormError('Выбраны несуществующие услуги')
      return null
    }

    setFormError(null)
    return {
      id: editingDoctorId ?? normalizedId,
      fullName: normalizedFullName,
      specialty: normalizedSpecialty,
      clinicName: normalizedClinicName,
      rating,
      serviceIds: formServiceIds,
    }
  }

  async function handleSubmitDoctor(): Promise<void> {
    const validated = validateForm()
    if (!validated) {
      return
    }

    setIsSaving(true)
    setMutationError(null)

    try {
      if (editingDoctorId) {
        const updated = await updateDoctor(editingDoctorId, {
          fullName: validated.fullName,
          specialty: validated.specialty,
          clinicName: validated.clinicName,
          rating: validated.rating,
          serviceIds: validated.serviceIds,
        })
        setDoctors((prev) => prev.map((doctor) => (doctor.id === updated.id ? updated : doctor)))
      } else {
        const created = await createDoctor(validated)
        setDoctors((prev) => [...prev, created])
      }

      resetForm()
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : 'Не удалось сохранить врача',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteDoctor(doctorId: string): Promise<void> {
    setDeletingDoctorId(doctorId)
    setMutationError(null)

    try {
      await deleteDoctor(doctorId)
      setDoctors((prev) => prev.filter((doctor) => doctor.id !== doctorId))
      if (editingDoctorId === doctorId) {
        resetForm()
      }
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : 'Не удалось удалить врача',
      )
    } finally {
      setDeletingDoctorId(null)
    }
  }

  function handleStartEdit(doctor: Doctor): void {
    setEditingDoctorId(doctor.id)
    setFormId(doctor.id)
    setFormFullName(doctor.fullName)
    setFormSpecialty(doctor.specialty)
    setFormClinicName(doctor.clinicName)
    setFormRating(String(doctor.rating))
    setFormServiceIds(doctor.serviceIds)
    setFormError(null)
    setMutationError(null)
  }

  function handleServiceToggle(serviceId: string): void {
    setFormServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((currentId) => currentId !== serviceId)
        : [...prev, serviceId],
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Администрирование врачей</h2>

      <Card title="Управление врачами" description="Реестр специалистов и доступных направлений">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="danger">Только для администратора</Badge>
          <Badge variant="default">Всего врачей: {doctors.length}</Badge>
        </div>
      </Card>

      {status === 'loading' && <LoadingDoctors />}

      {status === 'failed' && (
        <Card title="Не удалось загрузить врачей" description={error ?? 'Повторите попытку позже'}>
          <Button onClick={handleRetry}>Повторить</Button>
        </Card>
      )}

      {status === 'succeeded' && (
        <>
          <Card
            title={editingDoctor ? 'Редактирование врача' : 'Новый врач'}
            description={
              editingDoctor
                ? `Изменение врача: ${editingDoctor.fullName}`
                : 'Добавьте нового врача в реестр'
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="ID"
                value={formId}
                disabled={Boolean(editingDoctor)}
                onChange={(event) => {
                  setFormId(event.currentTarget.value)
                }}
                placeholder="doctor-custom-1"
              />
              <Input
                label="ФИО"
                value={formFullName}
                onChange={(event) => {
                  setFormFullName(event.currentTarget.value)
                }}
                placeholder="Иванов Иван Иванович"
              />
              <Input
                label="Специализация"
                value={formSpecialty}
                onChange={(event) => {
                  setFormSpecialty(event.currentTarget.value)
                }}
                placeholder="Терапевт"
              />
              <Input
                label="Клиника"
                value={formClinicName}
                onChange={(event) => {
                  setFormClinicName(event.currentTarget.value)
                }}
                placeholder="Клиника Здоровье"
              />
              <Input
                label="Рейтинг (0-5)"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={formRating}
                onChange={(event) => {
                  setFormRating(event.currentTarget.value)
                }}
                placeholder="4.8"
              />
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-slate-700">Доступные услуги</p>
              <div className="grid gap-2 md:grid-cols-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formServiceIds.includes(service.id)}
                      onChange={() => {
                        handleServiceToggle(service.id)
                      }}
                    />
                    {service.name}
                  </label>
                ))}
              </div>
            </div>

            {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
            {mutationError && <p className="mt-2 text-sm text-red-600">{mutationError}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleSubmitDoctor} disabled={isSaving}>
                {isSaving
                  ? 'Сохраняем...'
                  : editingDoctor
                    ? 'Сохранить изменения'
                    : 'Добавить врача'}
              </Button>
              {editingDoctor && (
                <Button variant="secondary" onClick={resetForm} disabled={isSaving}>
                  Отмена
                </Button>
              )}
            </div>
          </Card>

          <Card>
            {doctors.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {doctors.map((doctor) => (
                  <article key={doctor.id} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="text-sm font-semibold text-slate-900">{doctor.fullName}</h3>
                    <p className="text-sm text-slate-600">
                      {doctor.specialty} · {doctor.clinicName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Рейтинг: {doctor.rating.toFixed(1)} · Услуг: {doctor.serviceIds.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {doctor.serviceIds.map((serviceId) => serviceById.get(serviceId) ?? serviceId).join(', ')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          handleStartEdit(doctor)
                        }}
                        disabled={isSaving || deletingDoctorId === doctor.id}
                      >
                        Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void handleDeleteDoctor(doctor.id)
                        }}
                        disabled={isSaving || deletingDoctorId === doctor.id}
                      >
                        {deletingDoctorId === doctor.id ? 'Удаляем...' : 'Удалить'}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Список врачей пуст.</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default AdminDoctorsPage
