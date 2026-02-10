import { Link, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="app-container flex h-16 items-center justify-between">
          <Link to="/" className="text-base font-semibold text-slate-900">
            Система записи к врачу
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link to="/">Главная</Link>
            <Link to="/login">Вход</Link>
            <Link to="/signup">Регистрация</Link>
            <Link to="/forgot-password">Сброс пароля</Link>
          </nav>
        </div>
      </header>

      <main className="app-container py-10">
        <Outlet />
      </main>
    </div>
  )
}
