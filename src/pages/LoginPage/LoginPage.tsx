import { useCallback, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { loginThunk, selectAuthError, selectAuthStatus } from '@/features/auth/model'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'

const loginSchema = z.object({
  email: z.string().min(1, 'Укажите email').email('Некорректный формат email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAppSelector(selectAuthStatus)
  const serverError = useAppSelector(selectAuthError)
  const [lastSubmittedValues, setLastSubmittedValues] = useState<LoginFormValues | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/app'
  const isLoading = status === 'loading'
  const isServerUnavailable = useMemo(() => {
    if (!serverError) {
      return false
    }

    const normalizedError = serverError.toLowerCase()
    return normalizedError.includes('попробуйте позже') || normalizedError.includes('недоступен')
  }, [serverError])

  const onSubmit = useCallback(
    async (formValues: LoginFormValues) => {
      setLastSubmittedValues(formValues)
      const result = await dispatch(loginThunk(formValues))
      if (loginThunk.fulfilled.match(result)) {
        navigate(redirectTo, { replace: true })
      }
    },
    [dispatch, navigate, redirectTo],
  )

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title="Вход в систему" description="Авторизация пациента или администратора">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="Введите пароль"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          {isServerUnavailable && lastSubmittedValues && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isLoading}
              onClick={() => {
                void onSubmit(lastSubmittedValues)
              }}
            >
              Повторить
            </Button>
          )}

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>

          <p className="text-xs text-slate-500">
            Тестовые аккаунты: patient@example.com / patient123, admin@example.com / admin123
          </p>
          <p className="text-xs text-slate-500">
            Нет аккаунта?{' '}
            <Link to="/signup" className="font-medium text-brand-700 underline">
              Зарегистрироваться
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            Забыли пароль?{' '}
            <Link to="/forgot-password" className="font-medium text-brand-700 underline">
              Восстановить доступ
            </Link>
          </p>
        </form>
      </Card>
    </div>
  )
}

export default LoginPage
