import { zodResolver } from '@hookform/resolvers/zod'
import { type FocusEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { selectUser } from '@/features/auth/model'
import {
  checkAndCleanupExpiredHold,
  confirmBookingThunk,
  fetchDoctorSlots,
  fetchSlotById,
  releaseHold,
  selectSlots,
  validateEmailAvailability,
  validateBookingReason,
} from '@/features/booking/model'
import { fetchCatalogData, selectCatalogStatus, selectServices } from '@/features/catalog/model'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'

const phoneRegex = /^\+?[0-9]{10,15}$/

const bookingConfirmSchema = z.object({
  serviceId: z.string().min(1, 'Выберите услугу'),
  appointmentType: z.enum(['online', 'offline']),
  email: z.string().min(1, 'Укажите email').email('Некорректный формат email'),
  phone: z
    .string()
    .min(1, 'Укажите телефон')
    .regex(phoneRegex, 'Некорректный формат телефона'),
  reason: z.string().min(5, 'Укажите причину обращения (минимум 5 символов)'),
})

type BookingConfirmFormValues = z.infer<typeof bookingConfirmSchema>

function normalizeReason(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getSlotsRange(): { fromISO: string; toISO: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  end.setHours(23, 59, 59, 999)

  return {
    fromISO: start.toISOString(),
    toISO: end.toISOString(),
  }
}

function BookingConfirmPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { doctorId = '' } = useParams<{ doctorId: string }>()
  const [searchParams] = useSearchParams()
  const slotId = searchParams.get('slotId')
  const rescheduleAppointmentId = searchParams.get('rescheduleAppointmentId')
  const previousSlotId = searchParams.get('previousSlotId')

  const user = useAppSelector(selectUser)
  const services = useAppSelector(selectServices)
  const catalogStatus = useAppSelector(selectCatalogStatus)
  const slots = useAppSelector(selectSlots)

  const [slotLoading, setSlotLoading] = useState(() => {
    if (!slotId) {
      return false
    }
    return !slots.some((slot) => slot.id === slotId)
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [holdExpiredMessage, setHoldExpiredMessage] = useState<string | null>(null)
  const [slotUnavailable, setSlotUnavailable] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailValidationPending, setIsEmailValidationPending] = useState(false)
  const isMountedRef = useRef(true)

  const selectedSlot = useMemo(() => {
    if (!slotId) {
      return null
    }

    return slots.find((slot) => slot.id === slotId) ?? null
  }, [slotId, slots])

  const bookingBackLink = useMemo(() => {
    const nextSearch = new URLSearchParams()
    if (rescheduleAppointmentId) {
      nextSearch.set('rescheduleAppointmentId', rescheduleAppointmentId)
    }
    if (previousSlotId) {
      nextSearch.set('previousSlotId', previousSlotId)
    }

    const query = nextSearch.toString()
    return query ? `/app/booking/${doctorId}?${query}` : `/app/booking/${doctorId}`
  }, [doctorId, previousSlotId, rescheduleAppointmentId])

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<BookingConfirmFormValues>({
    resolver: zodResolver(bookingConfirmSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      serviceId: '',
      appointmentType: 'offline',
      email: user?.email ?? '',
      phone: '',
      reason: '',
    },
  })

  const reasonField = register('reason')
  const emailField = register('email')

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      void dispatch(releaseHold())
    }
  }, [dispatch])

  async function handleReasonBlur(event: FocusEvent<HTMLTextAreaElement>): Promise<void> {
    reasonField.onBlur(event)

    const reasonValue = event.currentTarget.value
    if (normalizeReason(reasonValue).length < 5) {
      return
    }

    const validationResult = await dispatch(
      validateBookingReason({
        reason: reasonValue,
        excludeAppointmentId: rescheduleAppointmentId ?? undefined,
      }),
    )
    if (validateBookingReason.fulfilled.match(validationResult)) {
      clearErrors('reason')
      return
    }

    setError('reason', {
      type: 'async',
      message: validationResult.payload ?? 'Не удалось проверить причину обращения. Повторите попытку.',
    })
  }

  async function handleEmailBlur(event: FocusEvent<HTMLInputElement>): Promise<void> {
    emailField.onBlur(event)

    const emailValue = event.currentTarget.value.trim().toLowerCase()
    if (!z.string().email().safeParse(emailValue).success) {
      return
    }

    setIsEmailValidationPending(true)
    const validationResult = await dispatch(validateEmailAvailability({ email: emailValue }))

    if (isMountedRef.current) {
      setIsEmailValidationPending(false)
    }

    if (validateEmailAvailability.fulfilled.match(validationResult)) {
      clearErrors('email')
      return
    }

    setError('email', {
      type: 'async',
      message: validationResult.payload ?? 'Не удалось проверить email. Повторите попытку.',
    })
  }

  useEffect(() => {
    if (services.length === 0 && catalogStatus === 'idle') {
      void dispatch(fetchCatalogData())
    }
  }, [catalogStatus, dispatch, services.length])

  useEffect(() => {
    if (services.length > 0) {
      setValue('serviceId', services[0].id, { shouldValidate: true })
    }
  }, [services, setValue])

  useEffect(() => {
    if (!slotId || slots.some((slot) => slot.id === slotId)) {
      return
    }

    let isActive = true

    void dispatch(fetchSlotById(slotId))
      .then((result) => {
        if (!isActive) {
          return
        }

        if (fetchSlotById.rejected.match(result)) {
          setSubmitError(result.payload ?? 'Не удалось загрузить выбранный слот')
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setSlotLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [dispatch, slotId, slots])

  useEffect(() => {
    let isActive = true

    void dispatch(checkAndCleanupExpiredHold()).then((result) => {
      if (!isActive || !checkAndCleanupExpiredHold.fulfilled.match(result)) {
        return
      }

      if (!result.payload.expired) {
        return
      }

      setHoldExpiredMessage(
        'Временная бронь истекла. Выберите слот заново, чтобы продолжить запись.',
      )

      const { fromISO, toISO } = getSlotsRange()
      void dispatch(fetchDoctorSlots({ doctorId, fromISO, toISO }))
    })

    return () => {
      isActive = false
    }
  }, [dispatch, doctorId])

  const onSubmit = handleSubmit(async (formValues) => {
    if (!slotId || !selectedSlot || !user) {
      setSubmitError('Недостаточно данных для подтверждения записи')
      return
    }

    setIsEmailValidationPending(true)
    const emailValidationResult = await dispatch(
      validateEmailAvailability({ email: formValues.email }),
    )
    setIsEmailValidationPending(false)

    if (validateEmailAvailability.rejected.match(emailValidationResult)) {
      setError('email', {
        type: 'async',
        message: emailValidationResult.payload ?? 'Не удалось проверить email. Повторите попытку.',
      })
      return
    }
    clearErrors('email')

    const reasonValidationResult = await dispatch(
      validateBookingReason({
        reason: formValues.reason,
        excludeAppointmentId: rescheduleAppointmentId ?? undefined,
      }),
    )
    if (validateBookingReason.rejected.match(reasonValidationResult)) {
      setError('reason', {
        type: 'async',
        message:
          reasonValidationResult.payload ??
          'Не удалось проверить причину обращения. Повторите попытку.',
      })
      return
    }
    clearErrors('reason')

    if (selectedSlot.status === 'booked' || selectedSlot.status === 'blocked') {
      setSlotUnavailable(true)
      setSubmitError('Слот уже занят')
      return
    }

    setSubmitError(null)
    setSlotUnavailable(false)
    setIsSubmitting(true)

    const result = await dispatch(
      confirmBookingThunk({
        doctorId,
        slotId,
        serviceId: formValues.serviceId,
        appointmentType: formValues.appointmentType,
        reason: formValues.reason,
        email: formValues.email,
        phone: formValues.phone,
        rescheduleAppointmentId: rescheduleAppointmentId ?? undefined,
        previousSlotId: previousSlotId ?? undefined,
      }),
    )

    if (confirmBookingThunk.fulfilled.match(result)) {
      navigate('/app/appointments', { replace: true })
      return
    }

    const message = result.payload ?? 'Не удалось подтвердить запись'
    setSubmitError(message)

    if (message === 'Слот уже занят') {
      setSlotUnavailable(true)
    }

    if (message === 'Время брони истекло') {
      setHoldExpiredMessage(
        'Временная бронь истекла. Выберите слот заново, чтобы продолжить запись.',
      )
    }

    setIsSubmitting(false)
  })

  if (!slotId) {
    return (
      <Card title="Слот не выбран" description="Вернитесь на шаг выбора времени приема.">
        <Link to={bookingBackLink}>
          <Button variant="secondary">Вернуться к слотам</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">
        {rescheduleAppointmentId ? 'Подтверждение переноса записи' : 'Подтверждение записи'}
      </h2>

      {holdExpiredMessage && (
        <Card title="Время брони истекло" description={holdExpiredMessage}>
          <Link to={bookingBackLink}>
            <Button variant="secondary">Вернуться к слотам</Button>
          </Link>
        </Card>
      )}

      {slotUnavailable && (
        <Card title="Слот уже занят" description="Выберите другой слот и повторите попытку.">
          <Link to={bookingBackLink}>
            <Button variant="secondary">Вернуться к слотам</Button>
          </Link>
        </Card>
      )}

      {slotLoading && (
        <Card data-testid="booking-confirm-skeleton">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      )}

      {!slotLoading && selectedSlot && !holdExpiredMessage && !slotUnavailable && (
        <Card
          title={`Запись к врачу #${doctorId}`}
          description={`Слот: ${new Date(selectedSlot.startAtISO).toLocaleString('ru-RU')}`}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="serviceId" className="block text-sm font-medium text-slate-700">
                Услуга
              </label>
              <select
                id="serviceId"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                {...register('serviceId')}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {errors.serviceId?.message && (
                <p className="text-xs text-red-600">{errors.serviceId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Тип приема</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="offline" {...register('appointmentType')} />
                Оффлайн
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="online" {...register('appointmentType')} />
                Онлайн
              </label>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email для подтверждения
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="name@example.com"
                {...emailField}
                onBlur={handleEmailBlur}
              />
              {isEmailValidationPending && (
                <p className="text-xs text-slate-500">Проверяем доступность email...</p>
              )}
              {errors.email?.message && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Телефон
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="+77011234567"
                {...register('phone')}
              />
              {errors.phone?.message && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
                Причина обращения
              </label>
              <textarea
                id="reason"
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Кратко опишите цель визита"
                {...reasonField}
                onBlur={handleReasonBlur}
              />
              <p className="text-xs text-slate-500">
                Причина проверяется асинхронно на дублирование ваших предыдущих записей.
              </p>
              {errors.reason?.message && (
                <p className="text-xs text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <Button type="submit" disabled={isSubmitting || isEmailValidationPending}>
              {isSubmitting
                ? 'Подтверждаем...'
                : isEmailValidationPending
                  ? 'Проверяем email...'
                  : rescheduleAppointmentId
                    ? 'Подтвердить перенос'
                    : 'Подтвердить'}
            </Button>
          </form>
        </Card>
      )}

      {!slotLoading && !selectedSlot && (
        <Card title="Слот не найден" description="Слот мог быть удален или уже недоступен.">
          <Link to={bookingBackLink}>
            <Button variant="secondary">Вернуться к слотам</Button>
          </Link>
        </Card>
      )}
    </div>
  )
}

export default BookingConfirmPage
