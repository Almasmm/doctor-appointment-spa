import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

function DoctorProfilePage() {
  const { doctorId = '' } = useParams<{ doctorId: string }>()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Профиль врача</h2>

      <Card
        title={`Врач #${doctorId}`}
        description="Информация о специалисте и переход к записи на ближайший доступный слот."
      >
        <div className="mb-4 flex items-center gap-2">
          <Badge>Профиль специалиста</Badge>
          <Badge variant="success">Онлайн-запись доступна</Badge>
        </div>
        <Link to={`/app/booking/${doctorId}`}>
          <Button>Перейти к записи</Button>
        </Link>
      </Card>
    </div>
  )
}

export default DoctorProfilePage
