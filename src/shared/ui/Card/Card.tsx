import type { HTMLAttributes } from 'react'
import { classNames } from '@/shared/lib/classNames'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
}

export function Card({ className, title, description, children, ...props }: CardProps) {
  return (
    <section
      className={classNames(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <header className="mb-4 space-y-1">
          {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
