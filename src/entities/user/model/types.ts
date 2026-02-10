export type UserRole = 'patient' | 'admin'

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  phone?: string
  verified?: boolean
}
