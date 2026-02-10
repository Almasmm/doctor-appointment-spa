import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

type ErrorBoundaryScope = 'global' | 'local'

interface ErrorBoundaryState {
  hasError: boolean
}

interface ErrorBoundaryProps extends PropsWithChildren {
  scope: ErrorBoundaryScope
}

const boundaryCopy: Record<
  ErrorBoundaryScope,
  { title: string; description: string; logLabel: string }
> = {
  global: {
    title: 'Произошла ошибка приложения',
    description: 'Обновите страницу, чтобы продолжить работу.',
    logLabel: 'GlobalErrorBoundary',
  },
  local: {
    title: 'Произошла ошибка блока',
    description: 'Обновите страницу, чтобы восстановить раздел.',
    logLabel: 'LocalErrorBoundary',
  },
}

class ErrorBoundaryCore extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { logLabel } = boundaryCopy[this.props.scope]
    console.error(`[${logLabel}]`, error, errorInfo)
  }

  private readonly handleRefresh = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { title, description } = boundaryCopy[this.props.scope]

    return (
      <Card title={title} description={description}>
        <Button onClick={this.handleRefresh}>Обновить</Button>
      </Card>
    )
  }
}

export function GlobalErrorBoundary({ children }: PropsWithChildren) {
  return <ErrorBoundaryCore scope="global">{children}</ErrorBoundaryCore>
}

export function LocalErrorBoundary({ children }: PropsWithChildren) {
  return <ErrorBoundaryCore scope="local">{children}</ErrorBoundaryCore>
}
