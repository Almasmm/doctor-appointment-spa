import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { getDoctors } from '@/entities/doctor/api/doctorApi'
import type { Doctor } from '@/entities/doctor/model/types'
import { getServices } from '@/entities/service/api/serviceApi'
import type { Service } from '@/entities/service/model/types'

export type CatalogStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

interface CatalogState {
  services: Service[]
  doctors: Doctor[]
  selectedServiceId: string | null
  search: string
  status: CatalogStatus
  error: string | null
}

const initialState: CatalogState = {
  services: [],
  doctors: [],
  selectedServiceId: null,
  search: '',
  status: 'idle',
  error: null,
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function filterCatalogDoctors(
  doctors: Doctor[],
  selectedServiceId: string | null,
  search: string,
): Doctor[] {
  const normalizedSearch = normalize(search)

  return doctors.filter((doctor) => {
    const serviceMatches =
      selectedServiceId === null || doctor.serviceIds.includes(selectedServiceId)

    if (!serviceMatches) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    const fullNameMatches = normalize(doctor.fullName).includes(normalizedSearch)
    const specialtyMatches = normalize(doctor.specialty).includes(normalizedSearch)
    return fullNameMatches || specialtyMatches
  })
}

export const fetchCatalogData = createAsyncThunk<
  { services: Service[]; doctors: Doctor[] },
  void,
  { rejectValue: string }
>('catalog/fetchCatalogData', async (_, { rejectWithValue }) => {
  try {
    const [services, doctors] = await Promise.all([getServices(), getDoctors()])
    return { services, doctors }
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Не удалось загрузить данные каталога',
    )
  }
})

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setSelectedServiceId(state, action: PayloadAction<string | null>) {
      state.selectedServiceId = action.payload
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalogData.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchCatalogData.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.services = action.payload.services
        state.doctors = action.payload.doctors
      })
      .addCase(fetchCatalogData.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message ?? 'Ошибка загрузки каталога'
      })
  },
})

const selectCatalogState = (state: RootState): CatalogState => state.catalog

export const selectServices = (state: RootState): Service[] => selectCatalogState(state).services
export const selectDoctors = (state: RootState): Doctor[] => selectCatalogState(state).doctors
export const selectCatalogStatus = (state: RootState): CatalogStatus =>
  selectCatalogState(state).status
export const selectCatalogError = (state: RootState): string | null =>
  selectCatalogState(state).error
export const selectSelectedServiceId = (state: RootState): string | null =>
  selectCatalogState(state).selectedServiceId
export const selectCatalogSearch = (state: RootState): string => selectCatalogState(state).search
export const selectFilteredDoctors = (state: RootState): Doctor[] =>
  filterCatalogDoctors(
    selectCatalogState(state).doctors,
    selectCatalogState(state).selectedServiceId,
    selectCatalogState(state).search,
  )

export const { setSearch, setSelectedServiceId } = catalogSlice.actions
export const catalogReducer = catalogSlice.reducer
