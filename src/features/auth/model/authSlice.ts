import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { loginByEmailPassword } from '@/entities/user/api/authApi'
import type { User } from '@/entities/user/model/types'
import type { RootState } from '@/app/store'

const AUTH_STORAGE_KEY = 'auth'

interface PersistedAuth {
  user: User
  token: string
}

interface AuthState {
  user: User | null
  token: string | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

interface LoginPayload {
  email: string
  password: string
}

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isPersistedAuth(value: unknown): value is PersistedAuth {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  const user = record.user
  const token = record.token

  if (typeof token !== 'string' || !user || typeof user !== 'object') {
    return false
  }

  const userRecord = user as Record<string, unknown>
  const hasValidPhone =
    !('phone' in userRecord) ||
    userRecord.phone === undefined ||
    typeof userRecord.phone === 'string'
  const hasValidVerified =
    !('verified' in userRecord) ||
    userRecord.verified === undefined ||
    typeof userRecord.verified === 'boolean'

  return (
    typeof userRecord.id === 'string' &&
    typeof userRecord.email === 'string' &&
    typeof userRecord.fullName === 'string' &&
    (userRecord.role === 'patient' || userRecord.role === 'admin') &&
    hasValidPhone &&
    hasValidVerified
  )
}

function saveAuthToStorage(payload: PersistedAuth): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

function clearAuthStorage(): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function loadPersistedAuth(): PersistedAuth | null {
  if (!isBrowserStorageAvailable()) {
    return null
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    return isPersistedAuth(parsed) ? parsed : null
  } catch {
    return null
  }
}

const persistedAuth = loadPersistedAuth()

const initialState: AuthState = {
  user: persistedAuth?.user ?? null,
  token: persistedAuth?.token ?? null,
  status: 'idle',
  error: null,
}

export const loginThunk = createAsyncThunk<PersistedAuth, LoginPayload, { rejectValue: string }>(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const user = await loginByEmailPassword(email, password)
      const token = `token-${user.id}`
      const payload = { user, token }
      saveAuthToStorage(payload)
      return payload
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Не удалось выполнить вход в систему'
      const normalizedMessage = rawMessage.toLowerCase()
      if (normalizedMessage.includes('500') || normalizedMessage.includes('внутрен')) {
        return rejectWithValue('Сервис временно недоступен. Попробуйте позже')
      }

      return rejectWithValue(
        rawMessage,
      )
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    initFromStorage(state, action: PayloadAction<PersistedAuth>) {
      state.user = action.payload.user
      state.token = action.payload.token
      state.error = null
    },
    logout(state) {
      state.user = null
      state.token = null
      state.status = 'idle'
      state.error = null
      clearAuthStorage()
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload.user
        state.token = action.payload.token
        state.error = null
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message ?? 'Ошибка авторизации'
      })
  },
})

const selectAuthState = (state: RootState): AuthState => state.auth

export const selectIsAuthed = (state: RootState): boolean => selectAuthState(state).token !== null
export const selectUser = (state: RootState): User | null => selectAuthState(state).user
export const selectRole = (state: RootState): User['role'] | null =>
  selectAuthState(state).user?.role ?? null
export const selectAuthStatus = (state: RootState): AuthState['status'] =>
  selectAuthState(state).status
export const selectAuthError = (state: RootState): string | null => selectAuthState(state).error

export const authReducer = authSlice.reducer
export const { initFromStorage, logout } = authSlice.actions
