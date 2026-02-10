import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

function LandingPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-10 text-white">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-brand-100">
          Медицинская платформа
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Запись к врачу</h1>
        <p className="mt-3 max-w-2xl text-sm text-brand-50 sm:text-base">
          Единая точка входа для пациентов, администраторов и медицинских учреждений: запись к врачу,
          управление расписанием и контроль всех визитов в одном приложении.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/login">
            <Button variant="secondary">Войти в систему</Button>
          </Link>
          <Link to="/app">
            <Button variant="ghost" className="bg-white/10 text-white hover:bg-white/20">
              Открыть личный кабинет
            </Button>
          </Link>
        </div>
      </section>

      <Card title="Ключевые возможности" description="Функциональность платформы в текущем релизе">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Структура по Feature-Sliced Design.</li>
          <li>Router с nested routes, guards и lazy loading.</li>
          <li>Redux Toolkit store + typed hooks.</li>
          <li>Каталог врачей, запись на слот, подтверждение визита и раздел «Мои записи».</li>
          <li>Ролевой доступ для пациента и администратора.</li>
          <li>Покрытие unit/integration/e2e тестами.</li>
        </ul>
      </Card>
    </div>
  )
}

export default LandingPage
