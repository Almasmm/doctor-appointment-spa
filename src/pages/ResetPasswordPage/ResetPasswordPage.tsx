import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { resetPasswordByToken } from '@/entities/user/api'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[A-Za-z]/, 'Пароль должен содержать буквы')
      .regex(/\d/, 'Пароль должен содержать цифры'),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastPassword, setLastPassword] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  async function submit(password: string): Promise<void> {
    if (!token) {
      setStatus('error')
      setError('Токен сброса не найден')
      return
    }

    setStatus('loading')
    setError(null)
    setLastPassword(password)

    try {
      await resetPasswordByToken(token, password)
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось обновить пароль. Повторите попытку.',
      )
    }
  }

  if (status === 'success') {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card title="Пароль обновлён" description="Теперь вы можете войти с новым паролем.">
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

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title="Новый пароль" description="Введите новый пароль для вашего аккаунта">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => {
            void submit(values.password)
          })}
          noValidate
        >
          <Input
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Подтверждение пароля"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {status === 'error' && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-2">
            <Button type="submit" fullWidth disabled={status === 'loading'}>
              {status === 'loading' ? 'Сохраняем...' : 'Сохранить пароль'}
            </Button>
            {status === 'error' && lastPassword && (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={status === 'loading'}
                onClick={() => {
                  void submit(lastPassword)
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

export default ResetPasswordPage
