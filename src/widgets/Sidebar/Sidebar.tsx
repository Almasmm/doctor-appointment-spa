import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@/app/store/hooks'
import { selectRole, selectUser } from '@/features/auth/model'
import { classNames } from '@/shared/lib/classNames'

interface NavigationItem {
  to: string
  label: string
}

const patientNavigation: NavigationItem[] = [
  { to: '/app', label: 'Панель' },
  { to: '/app/profile', label: 'Кабинет' },
  { to: '/app/catalog', label: 'Каталог врачей' },
  { to: '/app/appointments', label: 'Мои записи' },
]

const adminNavigation: NavigationItem[] = [
  { to: '/app/admin/doctors', label: 'Админ: врачи' },
  { to: '/app/admin/services', label: 'Админ: услуги' },
  { to: '/app/admin/slots', label: 'Админ: слоты' },
  { to: '/app/admin/appointments', label: 'Админ: записи' },
]

function SidebarLink({ to, label }: NavigationItem) {
  return (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        classNames(
          'block rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const user = useAppSelector(selectUser)
  const role = useAppSelector(selectRole)
  const isAdmin = role === 'admin'

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-full flex-col p-4">
        <div className="mb-6 rounded-xl bg-brand-50 p-4">
          <p className="text-xs uppercase tracking-wide text-brand-700">Doctor Appointment SPA</p>
          <p className="mt-1 text-sm font-semibold text-brand-900">Навигация приложения</p>
          <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">{user?.fullName ?? 'Пользователь'}</p>
            <p>{user?.email ?? 'email не указан'}</p>
            <p className="mt-1">
              Роль: <span className="font-medium">{isAdmin ? 'админ' : 'пациент'}</span>
            </p>
          </div>
        </div>

        <nav className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-slate-400">Пациент</p>
          {patientNavigation.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {isAdmin && (
          <nav className="mt-6 space-y-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-slate-400">Админ</p>
            {adminNavigation.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </nav>
        )}
      </div>
    </aside>
  )
}
