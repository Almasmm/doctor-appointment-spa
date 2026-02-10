type ClassValue = string | false | null | undefined

export function classNames(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
