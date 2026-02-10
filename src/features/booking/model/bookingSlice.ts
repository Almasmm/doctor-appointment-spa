import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import {
  createAppointment,
  getAppointmentsByUser,
  updateAppointment,
} from '@/entities/appointment/api/appointmentApi'
import type { AppointmentType } from '@/entities/appointment/model/types'
import { getUsersByEmail } from '@/entities/user/api'
import { getSlotById, getSlots, updateSlotStatus } from '@/entities/slot/api/slotApi'
import type { Slot } from '@/entities/slot/model/types'
import { createSlotHold, deleteSlotHold, getSlotHoldsByUser } from '@/entities/slotHold/api/slotHoldApi'
import type { SlotHold } from '@/entities/slotHold/model/types'
import { ASYNC_STATUS, type AsyncStatus } from '@/shared/model/asyncStatus'

interface FetchDoctorSlotsPayload {
  doctorId: string
  fromISO: string
  toISO: string
}

interface HoldSlotPayload {
  slotId: string
}

interface ValidateBookingReasonPayload {
  reason: string
  excludeAppointmentId?: string
}

interface ValidateEmailAvailabilityPayload {
  email: string
}

interface ConfirmBookingPayload {
  doctorId: string
  slotId: string
  serviceId: string
  appointmentType: AppointmentType
  reason: string
  email: string
  phone: string
  rescheduleAppointmentId?: string
  previousSlotId?: string
}

interface ConfirmBookingResult {
  appointmentId: string
  slotId: string
}

interface BookingState {
  slots: Slot[]
  status: AsyncStatus
  error: string | null
  selectedSlotId: string | null
  lastRequestedSlotId: string | null
  hold: SlotHold | null
  holdStatus: AsyncStatus
  holdError: string | null
}

const initialState: BookingState = {
  slots: [],
  status: ASYNC_STATUS.IDLE,
  error: null,
  selectedSlotId: null,
  lastRequestedSlotId: null,
  hold: null,
  holdStatus: ASYNC_STATUS.IDLE,
  holdError: null,
}

function toUserFriendlyHoldError(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (
    message.includes('409') ||
    lowerMessage.includes('занят') ||
    lowerMessage.includes('забронир') ||
    lowerMessage.includes('недоступ')
  ) {
    return 'Слот уже занят'
  }

  return message
}

function normalizeReason(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export const fetchDoctorSlots = createAsyncThunk<
  Slot[],
  FetchDoctorSlotsPayload,
  { rejectValue: string }
>('booking/fetchDoctorSlots', async ({ doctorId, fromISO, toISO }, { rejectWithValue }) => {
  try {
    return await getSlots({ doctorId, fromISO, toISO })
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Не удалось загрузить слоты')
  }
})

export const fetchSlotById = createAsyncThunk<Slot, string, { rejectValue: string }>(
  'booking/fetchSlotById',
  async (slotId, { rejectWithValue }) => {
    try {
      return await getSlotById(slotId)
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Не удалось загрузить выбранный слот',
      )
    }
  },
)

export const validateBookingReason = createAsyncThunk<
  true,
  ValidateBookingReasonPayload,
  { state: RootState; rejectValue: string }
>(
  'booking/validateBookingReason',
  async ({ reason, excludeAppointmentId }, { getState, rejectWithValue }) => {
  const userId = getState().auth.user?.id
  if (!userId) {
    return rejectWithValue('Требуется авторизация')
  }

  const normalizedReason = normalizeReason(reason)
  if (normalizedReason.length < 5) {
    return true
  }

  try {
    const appointments = await getAppointmentsByUser(userId)
    const hasDuplicateReason = appointments.some(
      (appointment) =>
        appointment.id !== excludeAppointmentId &&
        normalizeReason(appointment.reason) === normalizedReason,
    )

    if (hasDuplicateReason) {
      return rejectWithValue('У вас уже есть запись с такой причиной. Уточните описание.')
    }

    return true
  } catch {
    return rejectWithValue('Не удалось проверить причину обращения. Повторите попытку.')
  }
},
)

export const validateEmailAvailability = createAsyncThunk<
  true,
  ValidateEmailAvailabilityPayload,
  { state: RootState; rejectValue: string }
>('booking/validateEmailAvailability', async ({ email }, { getState, rejectWithValue }) => {
  const normalizedEmail = normalizeEmail(email)
  if (normalizedEmail.length === 0) {
    return rejectWithValue('Укажите email')
  }

  const currentUser = getState().auth.user
  const currentUserId = currentUser?.id ?? null
  const currentUserEmail = currentUser ? normalizeEmail(currentUser.email) : null
  if (currentUserEmail && currentUserEmail === normalizedEmail) {
    return true
  }

  try {
    const usersWithSameEmail = await getUsersByEmail(normalizedEmail)
    const hasConflict = usersWithSameEmail.some((user) => user.id !== currentUserId)

    if (hasConflict) {
      return rejectWithValue('Этот email уже используется. Укажите другой.')
    }

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось проверить email'

    if (message.includes('409') || message.toLowerCase().includes('email')) {
      return rejectWithValue('Этот email уже используется. Укажите другой.')
    }

    return rejectWithValue('Не удалось проверить email. Повторите попытку.')
  }
})

export const checkAndCleanupExpiredHold = createAsyncThunk<
  { expired: boolean; slotId: string | null },
  void,
  { state: RootState }
>('booking/checkAndCleanupExpiredHold', async (_, { getState }) => {
  const hold = getState().booking.hold
  if (!hold) {
    return { expired: false, slotId: null }
  }

  const holdExpiresAt = Date.parse(hold.expiresAtISO)
  const isExpired = Number.isFinite(holdExpiresAt) && holdExpiresAt < Date.now()

  if (!isExpired) {
    return { expired: false, slotId: null }
  }

  try {
    await deleteSlotHold(hold.id)
  } catch {
    // noop: hold can be deleted by another client/session
  }

  try {
    await updateSlotStatus(hold.slotId, 'free')
  } catch {
    // noop: slot can be updated by another client/session
  }

  return { expired: true, slotId: hold.slotId }
})

export const holdSlot = createAsyncThunk<
  SlotHold,
  HoldSlotPayload,
  { state: RootState; rejectValue: string }
>('booking/holdSlot', async ({ slotId }, { getState, rejectWithValue }) => {
  const userId = getState().auth.user?.id
  if (!userId) {
    return rejectWithValue('Для выбора слота требуется авторизация')
  }

  try {
    const hold = await createSlotHold(slotId, userId)
    await updateSlotStatus(slotId, 'held')
    return hold
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать временную бронь'
    return rejectWithValue(toUserFriendlyHoldError(message))
  }
})

interface ReleaseHoldResult {
  released: boolean
  slotId: string | null
}

export const releaseHold = createAsyncThunk<
  ReleaseHoldResult,
  void,
  { state: RootState; rejectValue: string }
>('booking/releaseHold', async (_, { getState, rejectWithValue }) => {
  const hold = getState().booking.hold

  if (!hold) {
    return { released: false, slotId: null }
  }

  try {
    await deleteSlotHold(hold.id)
    await updateSlotStatus(hold.slotId, 'free')
    return { released: true, slotId: hold.slotId }
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Не удалось снять бронь')
  }
})

export const confirmBookingThunk = createAsyncThunk<
  ConfirmBookingResult,
  ConfirmBookingPayload,
  { state: RootState; rejectValue: string }
>('booking/confirmBooking', async (payload, { dispatch, getState, rejectWithValue }) => {
  const user = getState().auth.user
  if (!user) {
    return rejectWithValue('Требуется авторизация')
  }

  const normalizedReason = normalizeReason(payload.reason)
  if (normalizedReason.length < 5) {
    return rejectWithValue('Укажите причину обращения (минимум 5 символов)')
  }

  try {
    const emailValidationResult = await dispatch(validateEmailAvailability({ email: payload.email }))
    if (validateEmailAvailability.rejected.match(emailValidationResult)) {
      return rejectWithValue(
        emailValidationResult.payload ?? 'Не удалось проверить email. Повторите попытку.',
      )
    }

    const reasonValidationResult = await dispatch(
      validateBookingReason({
        reason: payload.reason,
        excludeAppointmentId: payload.rescheduleAppointmentId,
      }),
    )
    if (validateBookingReason.rejected.match(reasonValidationResult)) {
      return rejectWithValue(
        reasonValidationResult.payload ?? 'Не удалось проверить причину обращения. Повторите попытку.',
      )
    }

    const activeHold = getState().booking.hold
    if (activeHold?.slotId === payload.slotId) {
      const holdExpiresAt = Date.parse(activeHold.expiresAtISO)
      if (Number.isFinite(holdExpiresAt) && holdExpiresAt < Date.now()) {
        try {
          await deleteSlotHold(activeHold.id)
        } catch {
          // noop: hold may already be removed
        }
        try {
          await updateSlotStatus(payload.slotId, 'free')
        } catch {
          // noop: slot may already be updated
        }
        return rejectWithValue('Время брони истекло')
      }
    }

    const latestSlot = await getSlotById(payload.slotId)
    if (latestSlot.status === 'booked' || latestSlot.status === 'blocked') {
      return rejectWithValue('Слот уже занят')
    }

    const appointment = payload.rescheduleAppointmentId
      ? await updateAppointment(payload.rescheduleAppointmentId, {
          slotId: payload.slotId,
          serviceId: payload.serviceId,
          appointmentType: payload.appointmentType,
          status: 'scheduled',
          reason: payload.reason,
          contactEmail: payload.email,
          contactPhone: payload.phone,
        })
      : await createAppointment({
          userId: user.id,
          doctorId: payload.doctorId,
          slotId: payload.slotId,
          serviceId: payload.serviceId,
          appointmentType: payload.appointmentType,
          status: 'scheduled',
          reason: payload.reason,
          contactEmail: payload.email,
          contactPhone: payload.phone,
          createdAtISO: new Date().toISOString(),
        })

    await updateSlotStatus(payload.slotId, 'booked')

    if (
      payload.rescheduleAppointmentId &&
      payload.previousSlotId &&
      payload.previousSlotId !== payload.slotId
    ) {
      await updateSlotStatus(payload.previousSlotId, 'free')
    }

    let holdId: string | null = activeHold?.slotId === payload.slotId ? activeHold.id : null
    if (!holdId) {
      const userHolds = await getSlotHoldsByUser(user.id)
      holdId = userHolds.find((item) => item.slotId === payload.slotId)?.id ?? null
    }

    if (holdId) {
      await deleteSlotHold(holdId)
    }

    return {
      appointmentId: appointment.id,
      slotId: payload.slotId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось подтвердить запись'

    if (message.includes('409') || message.toLowerCase().includes('занят')) {
      return rejectWithValue('Слот уже занят')
    }

    return rejectWithValue(message)
  }
})

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    selectSlot(state, action: PayloadAction<string | null>) {
      state.selectedSlotId = action.payload
    },
    clearBookingState(state) {
      state.selectedSlotId = null
      state.lastRequestedSlotId = null
      state.hold = null
      state.holdStatus = ASYNC_STATUS.IDLE
      state.holdError = null
      state.error = null
    },
    consumeHold(state, action: PayloadAction<string>) {
      if (state.hold?.slotId === action.payload) {
        state.hold = null
      }
      if (state.selectedSlotId === action.payload) {
        state.selectedSlotId = null
      }
      if (state.lastRequestedSlotId === action.payload) {
        state.lastRequestedSlotId = null
      }
      state.holdStatus = ASYNC_STATUS.IDLE
      state.holdError = null
    },
  },
  extraReducers: (builder) => {
    // State transition map:
    // - fetchDoctorSlots: IDLE|FAILED|SUCCEEDED -> LOADING -> SUCCEEDED|FAILED
    // - holdSlot: IDLE|FAILED|SUCCEEDED -> LOADING -> SUCCEEDED|FAILED
    // - releaseHold: SUCCEEDED|FAILED -> LOADING -> IDLE|FAILED
    // - confirmBookingThunk:
    //   - fulfilled -> holdStatus goes to IDLE, selected/hold cleared for booked slot
    //   - rejected('Время брони истекло') -> holdStatus goes to IDLE and slot resets to free
    //   - rejected(other) -> holdStatus keeps current value, holdError is updated
    builder
      .addCase(fetchDoctorSlots.pending, (state) => {
        state.status = ASYNC_STATUS.LOADING
        state.error = null
      })
      .addCase(fetchDoctorSlots.fulfilled, (state, action) => {
        state.status = ASYNC_STATUS.SUCCEEDED
        state.slots = action.payload
        state.error = null
        if (!action.payload.some((slot) => slot.id === state.selectedSlotId)) {
          state.selectedSlotId = null
        }
      })
      .addCase(fetchDoctorSlots.rejected, (state, action) => {
        state.status = ASYNC_STATUS.FAILED
        state.error = action.payload ?? action.error.message ?? 'Не удалось загрузить слоты'
      })
      .addCase(fetchSlotById.fulfilled, (state, action) => {
        const slotIndex = state.slots.findIndex((slot) => slot.id === action.payload.id)
        if (slotIndex >= 0) {
          state.slots[slotIndex] = action.payload
          return
        }
        state.slots.push(action.payload)
      })
      .addCase(checkAndCleanupExpiredHold.fulfilled, (state, action) => {
        if (!action.payload.expired || !action.payload.slotId) {
          return
        }

        const expiredSlotId = action.payload.slotId
        state.hold = null
        state.selectedSlotId = null
        state.lastRequestedSlotId = null
        state.holdStatus = ASYNC_STATUS.IDLE
        state.holdError = 'Время временной брони истекло. Выберите слот заново.'
        state.slots = state.slots.map((slot) =>
          slot.id === expiredSlotId ? { ...slot, status: 'free' } : slot,
        )
      })
      .addCase(holdSlot.pending, (state) => {
        state.holdStatus = ASYNC_STATUS.LOADING
        state.holdError = null
        state.lastRequestedSlotId = state.selectedSlotId
      })
      .addCase(holdSlot.fulfilled, (state, action) => {
        state.holdStatus = ASYNC_STATUS.SUCCEEDED
        state.holdError = null
        state.hold = action.payload
        state.selectedSlotId = action.payload.slotId
        state.lastRequestedSlotId = action.payload.slotId
        state.slots = state.slots.map((slot) => {
          if (slot.id === action.payload.slotId) {
            return { ...slot, status: 'held' }
          }
          return slot
        })
      })
      .addCase(holdSlot.rejected, (state, action) => {
        state.holdStatus = ASYNC_STATUS.FAILED
        state.holdError = action.payload ?? action.error.message ?? 'Ошибка бронирования слота'
        state.lastRequestedSlotId = action.meta.arg.slotId
        state.selectedSlotId = action.meta.arg.slotId
      })
      .addCase(releaseHold.pending, (state) => {
        state.holdStatus = ASYNC_STATUS.LOADING
        state.holdError = null
      })
      .addCase(releaseHold.fulfilled, (state, action) => {
        state.holdStatus = ASYNC_STATUS.IDLE
        state.holdError = null
        if (action.payload.released && action.payload.slotId) {
          state.slots = state.slots.map((slot) =>
            slot.id === action.payload.slotId ? { ...slot, status: 'free' } : slot,
          )
        }
        state.hold = null
        state.selectedSlotId = null
        state.lastRequestedSlotId = null
      })
      .addCase(releaseHold.rejected, (state, action) => {
        state.holdStatus = ASYNC_STATUS.FAILED
        state.holdError =
          action.payload ?? action.error.message ?? 'Не удалось снять временную бронь'
      })
      .addCase(confirmBookingThunk.fulfilled, (state, action) => {
        const slotId = action.payload.slotId
        state.slots = state.slots.map((slot) =>
          slot.id === slotId ? { ...slot, status: 'booked' } : slot,
        )
        if (state.hold?.slotId === slotId) {
          state.hold = null
        }
        if (state.selectedSlotId === slotId) {
          state.selectedSlotId = null
        }
        if (state.lastRequestedSlotId === slotId) {
          state.lastRequestedSlotId = null
        }
        state.holdStatus = ASYNC_STATUS.IDLE
        state.holdError = null
      })
      .addCase(confirmBookingThunk.rejected, (state, action) => {
        const message = action.payload ?? action.error.message ?? 'Не удалось подтвердить запись'
        if (message === 'Время брони истекло') {
          const slotId = action.meta.arg.slotId
          state.hold = null
          state.selectedSlotId = null
          state.lastRequestedSlotId = null
          state.holdStatus = ASYNC_STATUS.IDLE
          state.holdError = message
          state.slots = state.slots.map((slot) =>
            slot.id === slotId ? { ...slot, status: 'free' } : slot,
          )
          return
        }

        state.holdError = message
      })
  },
})

const selectBookingState = (state: RootState): BookingState => state.booking

export const selectSlots = (state: RootState): Slot[] => selectBookingState(state).slots
export const selectBookingStatus = (state: RootState): BookingState['status'] =>
  selectBookingState(state).status
export const selectBookingError = (state: RootState): string | null =>
  selectBookingState(state).error
export const selectSelectedSlotId = (state: RootState): string | null =>
  selectBookingState(state).selectedSlotId
export const selectLastRequestedSlotId = (state: RootState): string | null =>
  selectBookingState(state).lastRequestedSlotId
export const selectHold = (state: RootState): SlotHold | null => selectBookingState(state).hold
export const selectHoldStatus = (state: RootState): BookingState['holdStatus'] =>
  selectBookingState(state).holdStatus
export const selectHoldError = (state: RootState): string | null =>
  selectBookingState(state).holdError
export const selectSelectedSlot = (state: RootState): Slot | null => {
  const { selectedSlotId, slots } = selectBookingState(state)
  if (!selectedSlotId) {
    return null
  }

  return slots.find((slot) => slot.id === selectedSlotId) ?? null
}

export const { selectSlot, clearBookingState, consumeHold } = bookingSlice.actions
export const bookingReducer = bookingSlice.reducer
