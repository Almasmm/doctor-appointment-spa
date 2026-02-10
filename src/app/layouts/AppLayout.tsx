import { Outlet } from 'react-router-dom'
import { Header } from '@/widgets/Header'
import { Sidebar } from '@/widgets/Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Header />
          <main className="app-container flex-1 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
