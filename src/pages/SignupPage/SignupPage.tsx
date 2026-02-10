import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { getUsersByEmail, signupByEmailPassword } from '@/entities/user/api'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'

const signupSchema = z
  .object({
    fullName: z.string().min(3, 'Укажите ФИО (минимум 3 символа)'),
    email: z.string().min(1, 'Укажите email').email('Некорректный формат email'),
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

type SignupFormValues = z.infer<typeof signupSchema>

function SignupPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailChecking, setIsEmailChecking] = useState(false)
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const [lastSubmittedValues, setLastSubmittedValues] = useState<SignupFormValues | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const emailField = register('email')

  const verificationLink = useMemo(() => {
    if (!verificationToken) {
      return null
    }

    return `/verify/${verificationToken}`
  }, [verificationToken])

  const checkEmailAvailability = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!z.string().email().safeParse(normalizedEmail).success) {
        return
      }

      setIsEmailChecking(true)
      try {
        const users = await getUsersByEmail(normalizedEmail)
        if (users.length > 0) {
          setError('email', {
            type: 'async',
            message: 'Пользователь с таким email уже существует',
          })
          return
        }

        clearErrors('email')
      } catch {
        setError('email', {
          type: 'async',
          message: 'Не удалось проверить email. Повторите попытку.',
        })
      } finally {
        setIsEmailChecking(false)
      }
    },
    [clearErrors, setError],
  )

  const submitSignup = useCallback(async (values: SignupFormValues) => {
    setLastSubmittedValues(values)
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await signupByEmailPassword({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      })

      setVerificationToken(result.verificationToken)
      setSubmitError(null)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось создать аккаунт')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  if (verificationLink) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Card title="Проверьте почту" description="Подтвердите email перед входом в систему.">
          <div className="space-y-3 text-sm text-slate-600">
            <p>Для dev-режима используйте ссылку подтверждения:</p>
            <p>
              <Link className="font-medium text-brand-700 underline" to={verificationLink}>
                {verificationLink}
              </Link>
            </p>
            <p>
              После подтверждения аккаунта выполните вход на странице{' '}
              <Link className="font-medium text-brand-700 underline" to="/login">
                /login
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card title="Регистрация" description="Создайте аккаунт пациента для онлайн-записи">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => {
            void submitSignup(values)
          })}
          noValidate
        >
          <Input label="ФИО" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...emailField}
            onBlur={(event) => {
              emailField.onBlur(event)
              void checkEmailAvailability(event.currentTarget.value)
            }}
          />
          {isEmailChecking && <p className="text-xs text-slate-500">Проверяем email...</p>}
          <Input
            label="Пароль"
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

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="space-y-2">
            <Button type="submit" fullWidth disabled={isSubmitting || isEmailChecking}>
              {isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
            </Button>
            {submitError && lastSubmittedValues && (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={isSubmitting || isEmailChecking}
                onClick={() => {
                  void submitSignup(lastSubmittedValues)
                }}
              >
                Повторить
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Уже есть аккаунт?{' '}
            <Link className="font-medium text-brand-700 underline" to="/login">
              Войти
            </Link>
          </p>
        </form>
      </Card>
    </div>
  )
}

export default SignupPage
