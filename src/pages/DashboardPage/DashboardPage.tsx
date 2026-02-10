import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'

function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Панель пациента</h2>
        <Badge variant="success">Система активна</Badge>
      </div>

      <Card title="Добро пожаловать" description="Это стартовая точка защищенной зоны приложения">
        <p className="text-sm text-slate-600">
          Управляйте записями: переходите в каталог, выбирайте врача и время приема, подтверждайте
          визит и отслеживайте историю посещений в разделе «Мои записи».
        </p>
      </Card>
    </div>
  )
}

export default DashboardPage
