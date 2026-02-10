import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import {
  getAppointmentsByUser,
  updateAppointmentStatus,
} from '@/entities/appointment/api/appointmentApi'
import type { AppointmentStatus, AppointmentType } from '@/entities/appointment/model/types'
import { getDoctors } from '@/entities/doctor/api/doctorApi'
import { getAllSlots, updateSlotStatus } from '@/entities/slot/api/slotApi'

export interface AppointmentListItem {
  id: string
  doctorId: string
  slotId: string
  doctorName: string
  startAtISO: string
  appointmentType: AppointmentType
  status: AppointmentStatus
  reason: string
}

type CancelStatus = 'idle' | 'loading' | 'failed'

interface AppointmentsState {
  items: AppointmentListItem[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  cancelStatusById: Record<string, CancelStatus>
  cancelErrorById: Record<string, string | null>
}

const initialState: AppointmentsState = {
  items: [],
  status: 'idle',
  error: null,
  cancelStatusById: {},
  cancelErrorById: {},
}

function sortAppointments(items: AppointmentListItem[]): AppointmentListItem[] {
  const now = Date.now()

  return [...items].sort((left, right) => {
    const leftTimestamp = Date.parse(left.startAtISO)
    const rightTimestamp = Date.parse(right.startAtISO)
    const leftHasValidTime = Number.isFinite(leftTimestamp)
    const rightHasValidTime = Number.isFinite(rightTimestamp)

    if (!leftHasValidTime && !rightHasValidTime) {
      return 0
    }

    if (!leftHasValidTime) {
      return 1
    }

    if (!rightHasValidTime) {
      return -1
    }

    const leftIsUpcoming = leftTimestamp >= now
    const rightIsUpcoming = rightTimestamp >= now
    if (leftIsUpcoming !== rightIsUpcoming) {
      return leftIsUpcoming ? -1 : 1
    }

    return leftTimestamp - rightTimestamp
  })
}

export const fetchMyAppointments = createAsyncThunk<
  AppointmentListItem[],
  string,
  { rejectValue: string }
>('appointments/fetchMyAppointments', async (userId, { rejectWithValue }) => {
  try {
    const [appointments, doctors, slots] = await Promise.all([
      getAppointmentsByUser(userId),
      getDoctors(),
      getAllSlots(),
    ])

    const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]))
    const slotById = new Map(slots.map((slot) => [slot.id, slot.startAtISO]))

    return sortAppointments(
      appointments.map((appointment) => ({
        id: appointment.id,
        doctorId: appointment.doctorId,
        slotId: appointment.slotId,
        doctorName: doctorById.get(appointment.doctorId) ?? 'Неизвестный врач',
        startAtISO: slotById.get(appointment.slotId) ?? 'Дата не найдена',
        appointmentType: appointment.appointmentType,
        status: appointment.status,
        reason: appointment.reason,
      })),
    )
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Не удалось загрузить список записей',
    )
  }
})

export const cancelMyAppointment = createAsyncThunk<
  { appointmentId: string; status: AppointmentStatus },
  { appointmentId: string; slotId: string },
  { rejectValue: string }
>(
  'appointments/cancelMyAppointment',
  async ({ appointmentId, slotId }, { rejectWithValue }) => {
    try {
      await updateAppointmentStatus(appointmentId, 'cancelled')
      await updateSlotStatus(slotId, 'free')
      return { appointmentId, status: 'cancelled' }
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Не удалось отменить запись',
      )
    }
  },
)

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyAppointments.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchMyAppointments.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
        state.error = null
        state.cancelStatusById = {}
        state.cancelErrorById = {}
      })
      .addCase(fetchMyAppointments.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message ?? 'Ошибка загрузки записей'
      })
      .addCase(cancelMyAppointment.pending, (state, action) => {
        const appointmentId = action.meta.arg.appointmentId
        state.cancelStatusById[appointmentId] = 'loading'
        state.cancelErrorById[appointmentId] = null
      })
      .addCase(cancelMyAppointment.fulfilled, (state, action) => {
        const { appointmentId, status } = action.payload
        state.cancelStatusById[appointmentId] = 'idle'
        state.cancelErrorById[appointmentId] = null
        state.items = state.items.map((item) =>
          item.id === appointmentId ? { ...item, status } : item,
        )
      })
      .addCase(cancelMyAppointment.rejected, (state, action) => {
        const appointmentId = action.meta.arg.appointmentId
        state.cancelStatusById[appointmentId] = 'failed'
        state.cancelErrorById[appointmentId] =
          action.payload ?? action.error.message ?? 'Не удалось отменить запись'
      })
  },
})

const selectAppointmentsState = (state: RootState): AppointmentsState => state.appointments

export const selectMyAppointments = (state: RootState): AppointmentListItem[] =>
  selectAppointmentsState(state).items
export const selectAppointmentsStatus = (state: RootState): AppointmentsState['status'] =>
  selectAppointmentsState(state).status
export const selectAppointmentsError = (state: RootState): string | null =>
  selectAppointmentsState(state).error
export const selectCancelStatusById = (
  state: RootState,
  appointmentId: string,
): CancelStatus => selectAppointmentsState(state).cancelStatusById[appointmentId] ?? 'idle'
export const selectCancelErrorById = (state: RootState, appointmentId: string): string | null =>
  selectAppointmentsState(state).cancelErrorById[appointmentId] ?? null

export const appointmentsReducer = appointmentsSlice.reducer
