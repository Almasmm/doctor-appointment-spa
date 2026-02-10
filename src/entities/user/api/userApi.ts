import type { User } from '@/entities/user/model/types'
import { http } from '@/shared/lib/http'

interface UserRecord extends User {
  password: string
  verificationToken?: string | null
  resetToken?: string | null
}

export async function getUsersByEmail(email: string): Promise<User[]> {
  const query = new URLSearchParams({ email: email.trim().toLowerCase() })
  const users = await http<UserRecord[]>(`/users?${query.toString()}`)

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    verified: user.verified ?? true,
  }))
}
