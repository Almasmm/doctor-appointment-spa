import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { logout, selectRole, selectUser } from '@/features/auth/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

export function Header() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const role = useAppSelector(selectRole)

  const roleLabel = role === 'admin' ? 'админ' : role === 'patient' ? 'пациент' : 'гость'

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="app-container flex h-16 items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Здравствуйте, {user?.fullName ?? 'пользователь'}.
          </p>
          <h1 className="text-lg font-semibold text-slate-900">Система записи к врачу</h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="default">Роль: {roleLabel}</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dispatch(logout())
              navigate('/')
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    </header>
  )
}
