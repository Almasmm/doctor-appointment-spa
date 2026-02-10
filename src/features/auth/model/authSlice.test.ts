import { describe, expect, it } from 'vitest'
import type { RootState } from '@/app/store'
import type { User } from '@/entities/user/model/types'
import {
  authReducer,
  initFromStorage,
  loadPersistedAuth,
  loginThunk,
  logout,
  selectAuthError,
  selectAuthStatus,
  selectIsAuthed,
  selectRole,
  selectUser,
} from './authSlice'

const patientUser: User = {
  id: 'user-patient-1',
  email: 'patient@example.com',
  fullName: 'Смагулов Айдар Нурланович',
  role: 'patient',
}

describe('authSlice', () => {
  it('обрабатывает login fulfilled и logout', () => {
    window.localStorage.setItem(
      'auth',
      JSON.stringify({ user: patientUser, token: 'token-user-patient-1' }),
    )

    const stateAfterLogin = authReducer(
      undefined,
      loginThunk.fulfilled(
        {
          user: patientUser,
          token: 'token-user-patient-1',
        },
        '',
        {
          email: 'patient@example.com',
          password: 'patient123',
        },
      ),
    )

    expect(stateAfterLogin.user).toEqual(patientUser)
    expect(stateAfterLogin.token).toBe('token-user-patient-1')
    expect(stateAfterLogin.status).toBe('succeeded')
    expect(stateAfterLogin.error).toBeNull()

    const stateAfterLogout = authReducer(stateAfterLogin, logout())

    expect(stateAfterLogout.user).toBeNull()
    expect(stateAfterLogout.token).toBeNull()
    expect(stateAfterLogout.status).toBe('idle')
    expect(stateAfterLogout.error).toBeNull()
    expect(window.localStorage.getItem('auth')).toBeNull()
  })

  it('обрабатывает pending/rejected и initFromStorage', () => {
    const pendingState = authReducer(
      undefined,
      loginThunk.pending(
        'req-1',
        { email: 'patient@example.com', password: 'patient123' },
      ),
    )

    expect(pendingState.status).toBe('loading')
    expect(pendingState.error).toBeNull()

    const rejectedState = authReducer(
      pendingState,
      loginThunk.rejected(
        new Error('Unauthorized'),
        'req-1',
        { email: 'patient@example.com', password: 'wrong-password' },
        'Неверный email или пароль',
      ),
    )

    expect(rejectedState.status).toBe('failed')
    expect(rejectedState.error).toBe('Неверный email или пароль')

    const initializedState = authReducer(
      rejectedState,
      initFromStorage({
        user: patientUser,
        token: 'token-user-patient-1',
      }),
    )

    expect(initializedState.user).toEqual(patientUser)
    expect(initializedState.token).toBe('token-user-patient-1')
    expect(initializedState.error).toBeNull()
  })

  it('selectors корректно читают auth state', () => {
    const authState = {
      user: patientUser,
      token: 'token-user-patient-1',
      status: 'succeeded',
      error: null,
    } as const

    const rootState = {
      auth: authState,
    } as RootState

    expect(selectIsAuthed(rootState)).toBe(true)
    expect(selectUser(rootState)).toEqual(patientUser)
    expect(selectRole(rootState)).toBe('patient')
    expect(selectAuthStatus(rootState)).toBe('succeeded')
    expect(selectAuthError(rootState)).toBeNull()

    const anonymousState = {
      auth: {
        user: null,
        token: null,
        status: 'idle',
        error: null,
      },
    } as RootState

    expect(selectIsAuthed(anonymousState)).toBe(false)
    expect(selectRole(anonymousState)).toBeNull()
  })

  it('loadPersistedAuth возвращает корректные данные и null для невалидного payload', () => {
    window.localStorage.setItem('auth', JSON.stringify({ user: patientUser, token: 'token-1' }))
    expect(loadPersistedAuth()).toEqual({ user: patientUser, token: 'token-1' })

    window.localStorage.setItem('auth', '{"invalid":true}')
    expect(loadPersistedAuth()).toBeNull()

    window.localStorage.setItem('auth', '{broken-json')
    expect(loadPersistedAuth()).toBeNull()
  })
})
