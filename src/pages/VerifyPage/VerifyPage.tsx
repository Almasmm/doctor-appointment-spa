import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { verifyAccountByToken } from '@/entities/user/api'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

function VerifyPage() {
  const navigate = useNavigate()
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() =>
    token ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(() =>
    token ? null : 'Токен подтверждения не найден',
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) {
      return
    }

    let isActive = true

    const runVerification = async () => {
      try {
        await verifyAccountByToken(token)
        if (!isActive) {
          return
        }
        setStatus('success')
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }
        setStatus('error')
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось подтвердить аккаунт. Повторите попытку.',
        )
      }
    }

    void runVerification()

    return () => {
      isActive = false
    }
  }, [attempt, token])

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card title="Подтверждаем аккаунт" description="Пожалуйста, подождите..." />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card title="Не удалось подтвердить аккаунт" description={error ?? 'Попробуйте позже'}>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setStatus('loading')
                setError(null)
                setAttempt((prev) => prev + 1)
              }}
            >
              Повторить
            </Button>
            <Link to="/signup">
              <Button variant="secondary">К регистрации</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card
        title="Аккаунт подтверждён"
        description="Теперь вы можете войти в систему по email и паролю."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              navigate('/login', { replace: true })
            }}
          >
            Перейти ко входу
          </Button>
          <Link to="/login">
            <Button variant="secondary">/login</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default VerifyPage
