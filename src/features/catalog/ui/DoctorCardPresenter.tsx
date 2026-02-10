import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { Doctor } from '@/entities/doctor/model/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

interface DoctorCardPresenterProps {
  doctor: Doctor
}

// PERF: doctor cards stay stable while filters change in parent containers.
export const DoctorCardPresenter = memo(function DoctorCardPresenter({
  doctor,
}: DoctorCardPresenterProps) {
  return (
    <Card title={doctor.fullName} description={doctor.specialty}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="success">Рейтинг {doctor.rating.toFixed(1)}</Badge>
        <Badge>{doctor.clinicName}</Badge>
      </div>

      <div className="flex gap-2">
        <Link to={`/app/doctor/${doctor.id}`}>
          <Button size="sm">Профиль</Button>
        </Link>
        <Link to={`/app/booking/${doctor.id}`}>
          <Button size="sm" variant="secondary">
            Записаться
          </Button>
        </Link>
      </div>
    </Card>
  )
})
