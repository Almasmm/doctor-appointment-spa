import type { HTMLAttributes } from 'react'
import { classNames } from '@/shared/lib/classNames'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div className={classNames('animate-pulse rounded-md bg-slate-200', className)} {...props} />
  )
}
