import { Card } from '@/shared/ui/Card'

export interface AuthPresenterProps {
  title: string
  description: string
}

export function AuthPresenter({ title, description }: AuthPresenterProps) {
  return <Card title={title} description={description} />
}
