import { delay, http, HttpResponse, type RequestHandler } from 'msw'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from '@/entities/appointment/model/types'
import type { Doctor } from '@/entities/doctor/model/types'
import type { Service } from '@/entities/service/model/types'
import type { Slot } from '@/entities/slot/model/types'
import type { SlotHold } from '@/entities/slotHold/model/types'
import type { User } from '@/entities/user/model/types'

export const serviceFixtures: Service[] = [
  {
    id: 'service-therapist',
    name: 'Консультация терапевта',
    durationMin: 30,
    priceKzt: 9000,
  },
  {
    id: 'service-cardiologist',
    name: 'Консультация кардиолога',
    durationMin: 40,
    priceKzt: 12000,
  },
  {
    id: 'service-pediatrician',
    name: 'Консультация педиатра',
    durationMin: 30,
    priceKzt: 9500,
  },
  {
    id: 'service-endocrinologist',
    name: 'Консультация эндокринолога',
    durationMin: 40,
    priceKzt: 12500,
  },
]

function cloneServices(fixtures: Service[]): Service[] {
  return fixtures.map((service) => ({ ...service }))
}

export const doctorFixtures: Doctor[] = [
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
    serviceIds: ['service-cardiologist'],
  },
]

function cloneDoctors(fixtures: Doctor[]): Doctor[] {
  return fixtures.map((doctor) => ({
    ...doctor,
    serviceIds: [...doctor.serviceIds],
  }))
}

interface UserFixture extends User {
  password: string
  verificationToken?: string | null
  resetToken?: string | null
}

export const userFixtures: UserFixture[] = [
  {
    id: 'user-patient-1',
    email: 'patient@example.com',
    password: 'patient123',
    role: 'patient',
    fullName: 'Смагулов Айдар Нурланович',
    phone: '+77011234567',
    verified: true,
    verificationToken: null,
    resetToken: null,
  },
  {
    id: 'user-admin-1',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    fullName: 'Абдрахманова Айнура Сериковна',
    verified: true,
    verificationToken: null,
    resetToken: null,
  },
]

function cloneUsers(fixtures: UserFixture[]): UserFixture[] {
  return fixtures.map((user) => ({ ...user }))
}

function createSlotFixtures(): Slot[] {
  const baseDate = new Date()
  baseDate.setHours(0, 0, 0, 0)

  function toISO(dayOffset: number, hour: number, minute: number): string {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + dayOffset)
    date.setHours(hour, minute, 0, 0)
    return date.toISOString()
  }

  return [
    {
      id: 'slot-doctor-1-1',
      doctorId: 'doctor-1',
      startAtISO: toISO(1, 9, 0),
      endAtISO: toISO(1, 9, 45),
      status: 'free',
    },
    {
      id: 'slot-doctor-1-2',
      doctorId: 'doctor-1',
      startAtISO: toISO(1, 10, 0),
      endAtISO: toISO(1, 10, 45),
      status: 'free',
    },
    {
      id: 'slot-doctor-1-3',
      doctorId: 'doctor-1',
      startAtISO: toISO(1, 11, 0),
      endAtISO: toISO(1, 11, 45),
      status: 'booked',
    },
    {
      id: 'slot-doctor-1-4',
      doctorId: 'doctor-1',
      startAtISO: toISO(2, 9, 30),
      endAtISO: toISO(2, 10, 15),
      status: 'free',
    },
    {
      id: 'slot-doctor-2-1',
      doctorId: 'doctor-2',
      startAtISO: toISO(1, 12, 0),
      endAtISO: toISO(1, 12, 45),
      status: 'free',
    },
  ]
}

let slotsDb: Slot[] = []
let slotHoldsDb: SlotHold[] = []
let appointmentsDb: Appointment[] = []
let servicesDb: Service[] = []
let doctorsDb: Doctor[] = []
let usersDb: UserFixture[] = []
let slotHoldCounter = 1
let appointmentCounter = 1
let slotCounter = 1
let serviceCounter = 1
let doctorCounter = 1
let userCounter = 1

function normalizeAppointmentStatus(status: Appointment['status'] | undefined): AppointmentStatus {
  if (status === 'cancelled' || status === 'completed') {
    return status
  }

  return 'scheduled'
}

function normalizeAppointment(appointment: Appointment): Appointment {
  return {
    ...appointment,
    status: normalizeAppointmentStatus(appointment.status),
  }
}

function isExpired(expiresAtISO: string): boolean {
  const expiresAt = Date.parse(expiresAtISO)
  return Number.isFinite(expiresAt) && expiresAt < Date.now()
}

function cleanupExpiredHolds(): void {
  const expiredSlotIds = new Set(
    slotHoldsDb.filter((hold) => isExpired(hold.expiresAtISO)).map((hold) => hold.slotId),
  )

  if (expiredSlotIds.size === 0) {
    return
  }

  slotHoldsDb = slotHoldsDb.filter((hold) => !isExpired(hold.expiresAtISO))

  slotsDb = slotsDb.map((slot) => {
    if (expiredSlotIds.has(slot.id) && slot.status === 'held') {
      return { ...slot, status: 'free' }
    }
    return slot
  })
}

function getFilteredSlots(url: URL): Slot[] {
  const doctorId = url.searchParams.get('doctorId')
  const startAtISO_gte = url.searchParams.get('startAtISO_gte')
  const startAtISO_lte = url.searchParams.get('startAtISO_lte')
  const ids = url.searchParams.getAll('id')

  return slotsDb.filter((slot) => {
    if (doctorId && slot.doctorId !== doctorId) {
      return false
    }
    if (startAtISO_gte && slot.startAtISO < startAtISO_gte) {
      return false
    }
    if (startAtISO_lte && slot.startAtISO > startAtISO_lte) {
      return false
    }
    if (ids.length > 0 && !ids.includes(slot.id)) {
      return false
    }
    return true
  })
}

function parseDateOnly(dateValue: string): Date | null {
  const [yearText, monthText, dayText] = dateValue.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function parseLocalDateTime(dateValue: string, timeValue: string): Date | null {
  const [yearText, monthText, dayText] = dateValue.split('-')
  const [hourText, minuteText] = timeValue.split(':')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hours = Number(hourText)
  const minutes = Number(minuteText)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function formatDateAsLocalInput(dateValue: Date): string {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rangesOverlap(
  startLeftMs: number,
  endLeftMs: number,
  startRightMs: number,
  endRightMs: number,
): boolean {
  return startLeftMs < endRightMs && startRightMs < endLeftMs
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

function createToken(prefix: 'verify' | 'reset'): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${randomPart}`
}

function toPublicUser(user: UserFixture): User {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    verified: user.verified ?? true,
  }
}

export function resetMockDb(): void {
  servicesDb = cloneServices(serviceFixtures)
  doctorsDb = cloneDoctors(doctorFixtures)
  usersDb = cloneUsers(userFixtures)
  slotsDb = createSlotFixtures()
  slotHoldsDb = []
  appointmentsDb = []
  slotHoldCounter = 1
  appointmentCounter = 1
  slotCounter = slotsDb.length + 1
  serviceCounter = servicesDb.length + 1
  doctorCounter = doctorsDb.length + 1
  userCounter = usersDb.length + 1
}

resetMockDb()

export const handlers: RequestHandler[] = [
  http.post('*/auth/signup', async ({ request }) => {
    const body = (await request.json()) as {
      fullName?: string
      email?: string
      password?: string
    }

    const fullName = body.fullName?.trim() ?? ''
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''

    if (!fullName) {
      return HttpResponse.json({ message: 'Укажите ФИО' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return HttpResponse.json({ message: 'Некорректный формат email' }, { status: 400 })
    }

    if (!isStrongPassword(password)) {
      return HttpResponse.json(
        { message: 'Пароль должен быть не короче 8 символов и содержать буквы и цифры' },
        { status: 400 },
      )
    }

    if (usersDb.some((user) => normalizeEmail(user.email) === email)) {
      return HttpResponse.json(
        { message: 'Пользователь с таким email уже существует' },
        { status: 409 },
      )
    }

    const verificationToken = createToken('verify')
    const newUser: UserFixture = {
      id: `user-patient-${userCounter++}`,
      email,
      password,
      role: 'patient',
      fullName,
      verified: false,
      verificationToken,
      resetToken: null,
    }

    usersDb.push(newUser)

    return HttpResponse.json(
      {
        user: toPublicUser(newUser),
        verificationToken,
      },
      { status: 201 },
    )
  }),
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''

    if (!email || !password) {
      return HttpResponse.json({ message: 'Укажите email и пароль' }, { status: 400 })
    }

    const matchedUser = usersDb.find((user) => normalizeEmail(user.email) === email)
    if (!matchedUser || matchedUser.password !== password) {
      return HttpResponse.json({ message: 'Неверный email или пароль' }, { status: 401 })
    }

    if (matchedUser.verified === false) {
      return HttpResponse.json({ message: 'Подтвердите email перед входом' }, { status: 403 })
    }

    return HttpResponse.json({
      user: toPublicUser(matchedUser),
      token: `token-${matchedUser.id}-${Date.now()}`,
    })
  }),
  http.post('*/auth/verify', async ({ request }) => {
    const body = (await request.json()) as { token?: string }
    const token = body.token?.trim()

    if (!token) {
      return HttpResponse.json({ message: 'Токен подтверждения обязателен' }, { status: 400 })
    }

    const user = usersDb.find((item) => item.verificationToken === token)
    if (!user) {
      return HttpResponse.json({ message: 'Ссылка подтверждения недействительна' }, { status: 404 })
    }

    user.verified = true
    user.verificationToken = null

    return HttpResponse.json({ message: 'Аккаунт подтверждён' })
  }),
  http.post('*/auth/forgot-password', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    const email = normalizeEmail(body.email ?? '')

    if (!isValidEmail(email)) {
      return HttpResponse.json({ message: 'Некорректный формат email' }, { status: 400 })
    }

    const user = usersDb.find((item) => normalizeEmail(item.email) === email)
    if (!user) {
      return HttpResponse.json({ resetToken: null })
    }

    user.resetToken = createToken('reset')
    return HttpResponse.json({ resetToken: user.resetToken })
  }),
  http.post('*/auth/reset-password', async ({ request }) => {
    const body = (await request.json()) as { token?: string; newPassword?: string }
    const token = body.token?.trim()
    const newPassword = body.newPassword ?? ''

    if (!token) {
      return HttpResponse.json({ message: 'Токен сброса обязателен' }, { status: 400 })
    }

    if (!isStrongPassword(newPassword)) {
      return HttpResponse.json(
        { message: 'Пароль должен быть не короче 8 символов и содержать буквы и цифры' },
        { status: 400 },
      )
    }

    const user = usersDb.find((item) => item.resetToken === token)
    if (!user) {
      return HttpResponse.json(
        { message: 'Ссылка для сброса пароля недействительна' },
        { status: 404 },
      )
    }

    user.password = newPassword
    user.resetToken = null

    return HttpResponse.json({})
  }),
  http.get('*/services', async () => HttpResponse.json(servicesDb)),
  http.post('*/services', async ({ request }) => {
    const body = (await request.json()) as Partial<Service>
    const name = body.name?.trim()
    const durationMin = body.durationMin
    const priceKzt = body.priceKzt

    if (!name) {
      return HttpResponse.json({ message: 'Название услуги обязательно' }, { status: 400 })
    }

    if (!Number.isInteger(durationMin) || Number(durationMin) <= 0) {
      return HttpResponse.json({ message: 'Длительность должна быть положительным числом' }, { status: 400 })
    }

    if (!Number.isInteger(priceKzt) || Number(priceKzt) < 0) {
      return HttpResponse.json({ message: 'Стоимость должна быть неотрицательным числом' }, { status: 400 })
    }

    const normalizedName = name.toLowerCase()
    const hasNameConflict = servicesDb.some((service) => service.name.trim().toLowerCase() === normalizedName)
    if (hasNameConflict) {
      return HttpResponse.json({ message: 'Услуга с таким названием уже существует' }, { status: 409 })
    }

    const id = body.id?.trim() ? body.id.trim() : `service-custom-${serviceCounter++}`
    if (servicesDb.some((service) => service.id === id)) {
      return HttpResponse.json({ message: 'Услуга с таким id уже существует' }, { status: 409 })
    }

    const newService: Service = {
      id,
      name,
      durationMin: Number(durationMin),
      priceKzt: Number(priceKzt),
    }

    servicesDb.push(newService)
    return HttpResponse.json(newService, { status: 201 })
  }),
  http.patch('*/services/:serviceId', async ({ params, request }) => {
    const serviceId = String(params.serviceId)
    const target = servicesDb.find((service) => service.id === serviceId)
    if (!target) {
      return HttpResponse.json({ message: 'Услуга не найдена' }, { status: 404 })
    }

    const body = (await request.json()) as Partial<Service>
    const nextName = typeof body.name === 'string' ? body.name.trim() : target.name
    const nextDuration =
      body.durationMin === undefined ? target.durationMin : Number(body.durationMin)
    const nextPrice = body.priceKzt === undefined ? target.priceKzt : Number(body.priceKzt)

    if (!nextName) {
      return HttpResponse.json({ message: 'Название услуги обязательно' }, { status: 400 })
    }

    if (!Number.isInteger(nextDuration) || nextDuration <= 0) {
      return HttpResponse.json({ message: 'Длительность должна быть положительным числом' }, { status: 400 })
    }

    if (!Number.isInteger(nextPrice) || nextPrice < 0) {
      return HttpResponse.json({ message: 'Стоимость должна быть неотрицательным числом' }, { status: 400 })
    }

    const normalizedName = nextName.toLowerCase()
    const hasNameConflict = servicesDb.some(
      (service) => service.id !== serviceId && service.name.trim().toLowerCase() === normalizedName,
    )
    if (hasNameConflict) {
      return HttpResponse.json({ message: 'Услуга с таким названием уже существует' }, { status: 409 })
    }

    target.name = nextName
    target.durationMin = nextDuration
    target.priceKzt = nextPrice

    return HttpResponse.json(target)
  }),
  http.delete('*/services/:serviceId', async ({ params }) => {
    const serviceId = String(params.serviceId)
    const hasService = servicesDb.some((service) => service.id === serviceId)
    if (!hasService) {
      return HttpResponse.json({ message: 'Услуга не найдена' }, { status: 404 })
    }

    servicesDb = servicesDb.filter((service) => service.id !== serviceId)
    return HttpResponse.json({})
  }),
  http.get('*/doctors', async () => HttpResponse.json(doctorsDb)),
  http.post('*/doctors', async ({ request }) => {
    const body = (await request.json()) as Partial<Doctor>
    const id = body.id?.trim() ? body.id.trim() : `doctor-custom-${doctorCounter++}`
    const fullName = body.fullName?.trim() ?? ''
    const specialty = body.specialty?.trim() ?? ''
    const clinicName = body.clinicName?.trim() ?? ''
    const rating = Number(body.rating)
    const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : []

    if (doctorsDb.some((doctor) => doctor.id === id)) {
      return HttpResponse.json({ message: 'Врач с таким id уже существует' }, { status: 409 })
    }

    if (!fullName) {
      return HttpResponse.json({ message: 'ФИО врача обязательно' }, { status: 400 })
    }

    if (!specialty) {
      return HttpResponse.json({ message: 'Специализация обязательна' }, { status: 400 })
    }

    if (!clinicName) {
      return HttpResponse.json({ message: 'Название клиники обязательно' }, { status: 400 })
    }

    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      return HttpResponse.json({ message: 'Рейтинг должен быть в диапазоне от 0 до 5' }, { status: 400 })
    }

    const serviceIdsSet = new Set(serviceIds)
    const hasInvalidService = [...serviceIdsSet].some(
      (serviceId) => !servicesDb.some((service) => service.id === serviceId),
    )
    if (hasInvalidService) {
      return HttpResponse.json({ message: 'Указаны несуществующие услуги' }, { status: 400 })
    }

    const newDoctor: Doctor = {
      id,
      fullName,
      specialty,
      clinicName,
      rating,
      serviceIds: [...serviceIdsSet],
    }

    doctorsDb.push(newDoctor)
    return HttpResponse.json(newDoctor, { status: 201 })
  }),
  http.patch('*/doctors/:doctorId', async ({ params, request }) => {
    const doctorId = String(params.doctorId)
    const target = doctorsDb.find((doctor) => doctor.id === doctorId)
    if (!target) {
      return HttpResponse.json({ message: 'Врач не найден' }, { status: 404 })
    }

    const body = (await request.json()) as Partial<Doctor>
    const nextFullName = typeof body.fullName === 'string' ? body.fullName.trim() : target.fullName
    const nextSpecialty =
      typeof body.specialty === 'string' ? body.specialty.trim() : target.specialty
    const nextClinicName =
      typeof body.clinicName === 'string' ? body.clinicName.trim() : target.clinicName
    const nextRating = body.rating === undefined ? target.rating : Number(body.rating)
    const nextServiceIds = Array.isArray(body.serviceIds)
      ? [...new Set(body.serviceIds.map(String))]
      : target.serviceIds

    if (!nextFullName) {
      return HttpResponse.json({ message: 'ФИО врача обязательно' }, { status: 400 })
    }

    if (!nextSpecialty) {
      return HttpResponse.json({ message: 'Специализация обязательна' }, { status: 400 })
    }

    if (!nextClinicName) {
      return HttpResponse.json({ message: 'Название клиники обязательно' }, { status: 400 })
    }

    if (Number.isNaN(nextRating) || nextRating < 0 || nextRating > 5) {
      return HttpResponse.json({ message: 'Рейтинг должен быть в диапазоне от 0 до 5' }, { status: 400 })
    }

    const hasInvalidService = nextServiceIds.some(
      (serviceId) => !servicesDb.some((service) => service.id === serviceId),
    )
    if (hasInvalidService) {
      return HttpResponse.json({ message: 'Указаны несуществующие услуги' }, { status: 400 })
    }

    target.fullName = nextFullName
    target.specialty = nextSpecialty
    target.clinicName = nextClinicName
    target.rating = nextRating
    target.serviceIds = nextServiceIds

    return HttpResponse.json(target)
  }),
  http.delete('*/doctors/:doctorId', async ({ params }) => {
    const doctorId = String(params.doctorId)
    const hasDoctor = doctorsDb.some((doctor) => doctor.id === doctorId)
    if (!hasDoctor) {
      return HttpResponse.json({ message: 'Врач не найден' }, { status: 404 })
    }

    doctorsDb = doctorsDb.filter((doctor) => doctor.id !== doctorId)
    return HttpResponse.json({})
  }),
  http.post('*/slots/bulk', async ({ request }) => {
    const body = (await request.json()) as {
      doctorId?: string
      dateFrom?: string
      dateTo?: string
      workStart?: string
      workEnd?: string
      durationMin?: number
      stepMin?: number
    }

    const doctorId = body.doctorId?.trim() ?? ''
    const dateFrom = body.dateFrom ?? ''
    const dateTo = body.dateTo ?? ''
    const workStart = body.workStart ?? ''
    const workEnd = body.workEnd ?? ''
    const durationMin = Number(body.durationMin)
    const stepMin = body.stepMin === undefined ? durationMin : Number(body.stepMin)

    if (!doctorId) {
      return HttpResponse.json({ message: 'Выберите врача' }, { status: 400 })
    }

    if (!doctorsDb.some((doctor) => doctor.id === doctorId)) {
      return HttpResponse.json({ message: 'Врач не найден' }, { status: 404 })
    }

    const fromDate = parseDateOnly(dateFrom)
    const toDate = parseDateOnly(dateTo)
    if (!fromDate || !toDate) {
      return HttpResponse.json({ message: 'Некорректный диапазон дат' }, { status: 400 })
    }

    if (fromDate.getTime() > toDate.getTime()) {
      return HttpResponse.json(
        { message: 'Дата начала не может быть позже даты окончания' },
        { status: 400 },
      )
    }

    if (!Number.isInteger(durationMin) || durationMin <= 0) {
      return HttpResponse.json({ message: 'Некорректная длительность слота' }, { status: 400 })
    }

    if (!Number.isInteger(stepMin) || stepMin <= 0) {
      return HttpResponse.json({ message: 'Некорректный шаг генерации' }, { status: 400 })
    }

    const startBoundary = parseLocalDateTime(formatDateAsLocalInput(fromDate), workStart)
    const endBoundary = parseLocalDateTime(formatDateAsLocalInput(fromDate), workEnd)
    if (!startBoundary || !endBoundary || startBoundary.getTime() >= endBoundary.getTime()) {
      return HttpResponse.json({ message: 'Некорректные рабочие часы' }, { status: 400 })
    }

    const created: Slot[] = []
    let skipped = 0
    const nowMs = Date.now()

    for (
      const dayCursor = new Date(fromDate);
      dayCursor.getTime() <= toDate.getTime();
      dayCursor.setDate(dayCursor.getDate() + 1)
    ) {
      const localDate = formatDateAsLocalInput(dayCursor)
      const dayStart = parseLocalDateTime(localDate, workStart)
      const dayEnd = parseLocalDateTime(localDate, workEnd)

      if (!dayStart || !dayEnd || dayStart.getTime() >= dayEnd.getTime()) {
        return HttpResponse.json({ message: 'Некорректные рабочие часы' }, { status: 400 })
      }

      for (
        let startMs = dayStart.getTime();
        startMs + durationMin * 60_000 <= dayEnd.getTime();
        startMs += stepMin * 60_000
      ) {
        const endMs = startMs + durationMin * 60_000

        if (startMs < nowMs) {
          return HttpResponse.json(
            { message: 'Нельзя сгенерировать слоты в прошлом' },
            { status: 400 },
          )
        }

        const hasOverlap = slotsDb.some((slot) => {
          if (slot.doctorId !== doctorId) {
            return false
          }

          const slotStartMs = Date.parse(slot.startAtISO)
          const slotEndMs = Date.parse(slot.endAtISO)
          if (!Number.isFinite(slotStartMs) || !Number.isFinite(slotEndMs)) {
            return false
          }

          return rangesOverlap(startMs, endMs, slotStartMs, slotEndMs)
        })

        if (hasOverlap) {
          skipped += 1
          continue
        }

        const newSlot: Slot = {
          id: `slot-custom-${slotCounter++}`,
          doctorId,
          startAtISO: new Date(startMs).toISOString(),
          endAtISO: new Date(endMs).toISOString(),
          status: 'free',
        }
        slotsDb.push(newSlot)
        created.push(newSlot)
      }
    }

    return HttpResponse.json({ created, skipped }, { status: 201 })
  }),
  http.get('*/slots', async ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(getFilteredSlots(url))
  }),
  http.get('*/slots/:slotId', async ({ params }) => {
    const slotId = String(params.slotId)
    const slot = slotsDb.find((item) => item.id === slotId)
    if (!slot) {
      return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
    }

    return HttpResponse.json(slot)
  }),
  http.patch('*/slots/:slotId', async ({ params, request }) => {
    const slotId = String(params.slotId)
    const slot = slotsDb.find((item) => item.id === slotId)
    if (!slot) {
      return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
    }

    const patchPayload = (await request.json()) as Partial<Slot>

    Object.assign(slot, patchPayload)
    return HttpResponse.json(slot)
  }),
  http.get('*/users', async ({ request }) => {
    const url = new URL(request.url)
    const email = url.searchParams.get('email')
    const password = url.searchParams.get('password')
    const verificationToken = url.searchParams.get('verificationToken')
    const resetToken = url.searchParams.get('resetToken')

    if (email && password) {
      const matchedUsers = usersDb.filter(
        (user) =>
          normalizeEmail(user.email) === normalizeEmail(email) && user.password === password,
      )

      return HttpResponse.json(matchedUsers)
    }

    if (email) {
      const usersByEmail = usersDb.filter(
        (user) => normalizeEmail(user.email) === normalizeEmail(email),
      )
      return HttpResponse.json(usersByEmail)
    }

    if (verificationToken) {
      return HttpResponse.json(
        usersDb.filter((user) => user.verificationToken === verificationToken),
      )
    }

    if (resetToken) {
      return HttpResponse.json(usersDb.filter((user) => user.resetToken === resetToken))
    }

    return HttpResponse.json(usersDb)
  }),
  http.get('*/slotHolds', async ({ request }) => {
    cleanupExpiredHolds()

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const slotId = url.searchParams.get('slotId')

    const filtered = slotHoldsDb.filter((hold) => {
      if (userId && hold.userId !== userId) {
        return false
      }
      if (slotId && hold.slotId !== slotId) {
        return false
      }
      return true
    })

    return HttpResponse.json(filtered)
  }),
  http.post('*/slotHolds', async ({ request }) => {
    cleanupExpiredHolds()

    const body = (await request.json()) as Partial<SlotHold>
    const slotId = body.slotId
    const userId = body.userId

    if (!slotId || !userId) {
      return HttpResponse.json({ message: 'Невалидные данные' }, { status: 400 })
    }

    const slot = slotsDb.find((item) => item.id === slotId)
    if (!slot) {
      return HttpResponse.json({ message: 'Слот не найден' }, { status: 404 })
    }

    if (slot.status === 'booked' || slot.status === 'blocked') {
      return HttpResponse.json({ message: 'Слот уже занят' }, { status: 409 })
    }

    const existingHold = slotHoldsDb.find((hold) => hold.slotId === slotId)
    if (slot.status === 'held' && existingHold && existingHold.userId !== userId) {
      return HttpResponse.json(
        { message: 'Слот уже забронирован другим пользователем' },
        { status: 409 },
      )
    }

    if (slot.status === 'held' && !existingHold) {
      slot.status = 'free'
    }

    if (existingHold && existingHold.userId !== userId) {
      return HttpResponse.json(
        { message: 'Слот уже забронирован другим пользователем' },
        { status: 409 },
      )
    }

    if (existingHold && existingHold.userId === userId) {
      return HttpResponse.json(existingHold)
    }

    const newHold: SlotHold = {
      id: `slot-hold-${slotHoldCounter++}`,
      slotId,
      userId,
      expiresAtISO: body.expiresAtISO ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }

    slotHoldsDb.push(newHold)
    slot.status = 'held'

    return HttpResponse.json(newHold, { status: 201 })
  }),
  http.delete('*/slotHolds/:slotHoldId', async ({ params }) => {
    const slotHoldId = String(params.slotHoldId)
    const existingHold = slotHoldsDb.find((hold) => hold.id === slotHoldId)
    slotHoldsDb = slotHoldsDb.filter((hold) => hold.id !== slotHoldId)

    if (existingHold) {
      const slot = slotsDb.find((item) => item.id === existingHold.slotId)
      if (slot && slot.status === 'held') {
        slot.status = 'free'
      }
    }

    return HttpResponse.json({})
  }),
  http.get('*/appointments', async ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const doctorId = url.searchParams.get('doctorId')
    const status = url.searchParams.get('status') as AppointmentStatus | null

    const filtered = appointmentsDb.filter((appointment) => {
      if (userId && appointment.userId !== userId) {
        return false
      }
      if (doctorId && appointment.doctorId !== doctorId) {
        return false
      }
      if (status && appointment.status !== status) {
        return false
      }

      return true
    })

    return HttpResponse.json(filtered.map(normalizeAppointment))
  }),
  http.post('*/appointments', async ({ request }) => {
    const body = (await request.json()) as Partial<Omit<Appointment, 'id'>> & { id?: string }
    const newAppointment: Appointment = {
      ...body,
      id: body.id ?? `appointment-${appointmentCounter++}`,
      appointmentType: body.appointmentType as AppointmentType,
      status: normalizeAppointmentStatus(body.status),
      userId: String(body.userId),
      doctorId: String(body.doctorId),
      slotId: String(body.slotId),
      serviceId: String(body.serviceId),
      reason: String(body.reason ?? ''),
      createdAtISO: body.createdAtISO ?? new Date().toISOString(),
    }

    appointmentsDb.push(newAppointment)
    return HttpResponse.json(normalizeAppointment(newAppointment), { status: 201 })
  }),
  http.patch('*/appointments/:appointmentId', async ({ params, request }) => {
    const appointmentId = String(params.appointmentId)
    const target = appointmentsDb.find((appointment) => appointment.id === appointmentId)
    if (!target) {
      return HttpResponse.json({ message: 'Запись не найдена' }, { status: 404 })
    }

    const body = (await request.json()) as Partial<Appointment>
    if (body.slotId !== undefined) {
      target.slotId = String(body.slotId)
    }
    if (body.serviceId !== undefined) {
      target.serviceId = String(body.serviceId)
    }
    if (body.appointmentType === 'online' || body.appointmentType === 'offline') {
      target.appointmentType = body.appointmentType
    }
    if (body.reason !== undefined) {
      target.reason = String(body.reason)
    }
    if (body.contactEmail !== undefined) {
      target.contactEmail = String(body.contactEmail)
    }
    if (body.contactPhone !== undefined) {
      target.contactPhone = String(body.contactPhone)
    }
    target.status = normalizeAppointmentStatus(body.status ?? target.status)

    return HttpResponse.json(normalizeAppointment(target))
  }),
]

export const delayedCatalogHandlers: RequestHandler[] = [
  http.get('*/services', async () => {
    await delay(2000)
    return HttpResponse.json(servicesDb)
  }),
  http.get('*/doctors', async () => {
    await delay(2000)
    return HttpResponse.json(doctorsDb)
  }),
]

export const doctors500Handlers: RequestHandler[] = [
  http.get('*/doctors', async () =>
    HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
  ),
]

export const slots500Handlers: RequestHandler[] = [
  http.get('*/slots', async () =>
    HttpResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 }),
  ),
]

export const slotById404Handlers: RequestHandler[] = [
  http.get('*/slots/:slotId', async () =>
    HttpResponse.json({ message: 'Слот не найден' }, { status: 404 }),
  ),
]

export const delayedSlotsHandlers: RequestHandler[] = [
  http.get('*/slots', async ({ request }) => {
    await delay(2000)
    const url = new URL(request.url)
    return HttpResponse.json(getFilteredSlots(url))
  }),
]

export const delayedBookingConfirmHandlers: RequestHandler[] = [
  http.post('*/appointments', async ({ request }) => {
    await delay(2500)
    const body = (await request.json()) as Partial<Omit<Appointment, 'id'>> & { id?: string }
    const newAppointment: Appointment = {
      ...body,
      id: body.id ?? `appointment-${appointmentCounter++}`,
      appointmentType: body.appointmentType as AppointmentType,
      status: normalizeAppointmentStatus(body.status),
      userId: String(body.userId),
      doctorId: String(body.doctorId),
      slotId: String(body.slotId),
      serviceId: String(body.serviceId),
      reason: String(body.reason ?? ''),
      createdAtISO: body.createdAtISO ?? new Date().toISOString(),
    }

    appointmentsDb.push(newAppointment)
    return HttpResponse.json(normalizeAppointment(newAppointment), { status: 201 })
  }),
]

export const conflictHoldHandlers: RequestHandler[] = [
  http.post('*/slotHolds', async () =>
    HttpResponse.json({ message: 'Слот уже занят' }, { status: 409 }),
  ),
]
