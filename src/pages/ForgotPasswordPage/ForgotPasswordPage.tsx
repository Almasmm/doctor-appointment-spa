import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { requestPasswordReset } from '@/entities/user/api'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Укажите email').email('Некорректный формат email'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function submit(email: string): Promise<void> {
    setStatus('loading')
    setError(null)
    setLastEmail(email)

    try {
      const result = await requestPasswordReset(email)
      setResetToken(result.resetToken)
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось выполнить запрос. Повторите попытку.',
      )
    }
  }

  if (status === 'success') {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Card
          title="Проверьте почту"
          description="Если email существует, мы подготовили ссылку для сброса пароля."
        >
          <div className="space-y-3 text-sm text-slate-600">
            {resetToken ? (
              <p>
                Dev-ссылка для сброса: {' '}
                <Link className="font-medium text-brand-700 underline" to={`/reset-password/${resetToken}`}>
                  /reset-password/{resetToken}
                </Link>
              </p>
            ) : (
              <p>Ссылка отправлена (или email не найден в системе).</p>
            )}
            <Link className="font-medium text-brand-700 underline" to="/login">
              Вернуться ко входу
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title="Сброс пароля" description="Укажите email, и мы подготовим ссылку для сброса">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => {
            void submit(values.email)
          })}
          noValidate
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {status === 'error' && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-2">
            <Button type="submit" fullWidth disabled={status === 'loading'}>
              {status === 'loading' ? 'Проверяем...' : 'Отправить ссылку'}
            </Button>
            {status === 'error' && (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={status === 'loading'}
                onClick={() => {
                  void submit(lastEmail)
                }}
              >
                Повторить
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

export default ForgotPasswordPage
