import type { User } from '@/entities/user/model/types'
import { http } from '@/shared/lib/http'

interface UserRecord extends User {
  password: string
  verificationToken?: string | null
  resetToken?: string | null
}

interface LoginResponse {
  user: UserRecord
  token: string
}

interface SignupResponse {
  user: UserRecord
  verificationToken: string
}

interface ForgotPasswordResponse {
  resetToken: string | null
}

interface SignupPayload {
  fullName: string
  email: string
  password: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeUser(userRecord: UserRecord): User {
  return {
    id: userRecord.id,
    email: userRecord.email,
    fullName: userRecord.fullName,
    role: userRecord.role,
    phone: userRecord.phone,
    verified: userRecord.verified ?? true,
  }
}

function isEndpointMissingError(message: string): boolean {
  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('404') || normalizedMessage.includes('not found')
}

function createToken(prefix: 'verify' | 'reset'): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${random}`
}

async function getUsersByEmailRaw(email: string): Promise<UserRecord[]> {
  const query = new URLSearchParams({ email: normalizeEmail(email) })
  return http<UserRecord[]>(`/users?${query.toString()}`)
}

async function loginViaUsersFallback(email: string, password: string): Promise<User> {
  const users = await getUsersByEmailRaw(email)
  const matchedUser = users.find(
    (user) => user.email.toLowerCase() === normalizeEmail(email) && user.password === password,
  )

  if (!matchedUser) {
    throw new Error('Неверный email или пароль')
  }

  if (matchedUser.verified === false) {
    throw new Error('Подтвердите email перед входом')
  }

  return normalizeUser(matchedUser)
}

async function signupViaUsersFallback(payload: SignupPayload): Promise<SignupResponse> {
  const usersByEmail = await getUsersByEmailRaw(payload.email)
  if (usersByEmail.length > 0) {
    throw new Error('Пользователь с таким email уже существует')
  }

  const verificationToken = createToken('verify')
  const createdUser = await http<UserRecord>('/users', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(payload.email),
      fullName: payload.fullName.trim(),
      password: payload.password,
      role: 'patient',
      verified: false,
      verificationToken,
      resetToken: null,
      phone: null,
    }),
  })

  return {
    user: createdUser,
    verificationToken,
  }
}

async function verifyViaUsersFallback(token: string): Promise<void> {
  const query = new URLSearchParams({ verificationToken: token })
  const users = await http<UserRecord[]>(`/users?${query.toString()}`)
  const targetUser = users[0]

  if (!targetUser) {
    throw new Error('Ссылка подтверждения недействительна')
  }

  await http<UserRecord>(`/users/${targetUser.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      verified: true,
      verificationToken: null,
    }),
  })
}

async function forgotPasswordViaUsersFallback(email: string): Promise<ForgotPasswordResponse> {
  const users = await getUsersByEmailRaw(email)
  const targetUser = users[0]

  if (!targetUser) {
    return { resetToken: null }
  }

  const resetToken = createToken('reset')
  await http<UserRecord>(`/users/${targetUser.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ resetToken }),
  })

  return { resetToken }
}

async function resetPasswordViaUsersFallback(token: string, newPassword: string): Promise<void> {
  const query = new URLSearchParams({ resetToken: token })
  const users = await http<UserRecord[]>(`/users?${query.toString()}`)
  const targetUser = users[0]

  if (!targetUser) {
    throw new Error('Ссылка для сброса пароля недействительна')
  }

  await http<UserRecord>(`/users/${targetUser.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      password: newPassword,
      resetToken: null,
    }),
  })
}

export async function loginByEmailPassword(email: string, password: string): Promise<User> {
  try {
    const payload = await http<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizeEmail(email),
        password,
      }),
    })

    return normalizeUser(payload.user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось выполнить вход в систему'
    if (isEndpointMissingError(message)) {
      return loginViaUsersFallback(email, password)
    }

    throw new Error(message)
  }
}

export async function signupByEmailPassword(payload: SignupPayload): Promise<SignupResponse> {
  const normalizedPayload: SignupPayload = {
    fullName: payload.fullName.trim(),
    email: normalizeEmail(payload.email),
    password: payload.password,
  }

  try {
    return await http<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать аккаунт'
    if (isEndpointMissingError(message)) {
      return signupViaUsersFallback(normalizedPayload)
    }

    throw new Error(message)
  }
}

export async function verifyAccountByToken(token: string): Promise<void> {
  try {
    await http<Record<string, never>>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось подтвердить аккаунт'
    if (isEndpointMissingError(message)) {
      await verifyViaUsersFallback(token)
      return
    }

    throw new Error(message)
  }
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  try {
    return await http<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: normalizeEmail(email) }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос'
    if (isEndpointMissingError(message)) {
      return forgotPasswordViaUsersFallback(email)
    }

    throw new Error(message)
  }
}

export async function resetPasswordByToken(token: string, newPassword: string): Promise<void> {
  try {
    await http<Record<string, never>>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось обновить пароль'
    if (isEndpointMissingError(message)) {
      await resetPasswordViaUsersFallback(token, newPassword)
      return
    }

    throw new Error(message)
  }
}
