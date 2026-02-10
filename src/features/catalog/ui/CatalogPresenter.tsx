import type { Doctor } from '@/entities/doctor/model/types'
import type { Service } from '@/entities/service/model/types'
import type { CatalogStatus } from '@/features/catalog/model'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import { DoctorCardPresenter } from './DoctorCardPresenter'

export interface CatalogPresenterProps {
  services: Service[]
  filteredDoctors: Doctor[]
  selectedServiceId: string | null
  search: string
  status: CatalogStatus
  error: string | null
  onRetry: () => void
  onServiceChange: (value: string | null) => void
  onSearchChange: (value: string) => void
}

function LoadingCatalog() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`catalog-skeleton-${index}`} className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-2">
            <Skeleton className="h-9 w-44" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export function CatalogPresenter({
  services,
  filteredDoctors,
  selectedServiceId,
  search,
  status,
  error,
  onRetry,
  onServiceChange,
  onSearchChange,
}: CatalogPresenterProps) {
  const isLoading = status === 'loading'
  const isFailed = status === 'failed'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Каталог врачей</h2>
        <p className="mt-1 text-sm text-slate-500">
          Найдите врача по специализации, имени и типу медицинской услуги.
        </p>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-1.5">
            <label htmlFor="service-filter" className="block text-sm font-medium text-slate-700">
              Услуга
            </label>
            <select
              id="service-filter"
              value={selectedServiceId ?? ''}
              onChange={(event) => {
                onServiceChange(event.target.value || null)
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Все услуги</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Поиск врача"
            placeholder="Введите ФИО или специализацию"
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value)
            }}
          />
        </div>
      </Card>

      {isLoading && <LoadingCatalog />}

      {isFailed && (
        <Card
          title="Не удалось загрузить каталог"
          description={error ?? 'Произошла неизвестная ошибка'}
        >
          <Button onClick={onRetry}>Повторить</Button>
        </Card>
      )}

      {!isLoading && !isFailed && (
        <>
          {filteredDoctors.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDoctors.map((doctor) => (
                <DoctorCardPresenter key={doctor.id} doctor={doctor} />
              ))}
            </div>
          ) : (
            <Card
              title="Ничего не найдено"
              description="Попробуйте изменить фильтр услуги или поисковый запрос."
            />
          )}
        </>
      )}
    </div>
  )
}
