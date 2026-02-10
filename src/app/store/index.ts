import { combineReducers, configureStore, createSlice } from '@reduxjs/toolkit'
import { appointmentsReducer } from '@/features/appointments/model'
import { authReducer } from '@/features/auth/model'
import { bookingReducer } from '@/features/booking/model'
import { catalogReducer } from '@/features/catalog/model'

interface UiState {
  sidebarExpanded: boolean
}

const initialState: UiState = {
  sidebarExpanded: true,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarExpanded = !state.sidebarExpanded
    },
  },
})

export const uiActions = uiSlice.actions

const rootReducer = combineReducers({
  ui: uiSlice.reducer,
  catalog: catalogReducer,
  auth: authReducer,
  booking: bookingReducer,
  appointments: appointmentsReducer,
})

export function createAppStore(preloadedState?: Partial<ReturnType<typeof rootReducer>>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

export const store = createAppStore()
