import { Card } from '@/shared/ui/Card'

export interface AdminPresenterProps {
  title: string
  description: string
}

export function AdminPresenter({ title, description }: AdminPresenterProps) {
  return <Card title={title} description={description} />
}
