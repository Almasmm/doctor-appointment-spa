import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BookingContainer } from '@/features/booking/ui'

function BookingPage() {
  const { doctorId = '' } = useParams<{ doctorId: string }>()
  const [searchParams] = useSearchParams()

  const confirmSearchParams = useMemo(() => {
    const params = new URLSearchParams()
    const rescheduleAppointmentId = searchParams.get('rescheduleAppointmentId')
    const previousSlotId = searchParams.get('previousSlotId')

    if (rescheduleAppointmentId) {
      params.set('rescheduleAppointmentId', rescheduleAppointmentId)
    }
    if (previousSlotId) {
      params.set('previousSlotId', previousSlotId)
    }

    return params.toString()
  }, [searchParams])

  return <BookingContainer doctorId={doctorId} confirmSearchParams={confirmSearchParams} />
}

export default BookingPage
