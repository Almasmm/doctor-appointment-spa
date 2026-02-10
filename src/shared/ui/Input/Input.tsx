import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { classNames } from '@/shared/lib/classNames'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, name, label, error, helperText, className, containerClassName, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? name ?? generatedId
  const describedById = `${inputId}-description`

  return (
    <div className={classNames('space-y-1.5', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? describedById : undefined}
        className={classNames(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
          'transition-colors focus:border-brand-500',
          error ? 'border-red-500 focus:border-red-500' : 'border-slate-300',
          className,
        )}
        {...props}
      />

      {(error || helperText) && (
        <p
          id={describedById}
          className={classNames('text-xs', error ? 'text-red-600' : 'text-slate-500')}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  )
})
