export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:3001'

function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalizedPath}`
}

function extractErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message
    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  return null
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message: string | null = null
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    if (contentType.includes('application/json')) {
      try {
        const jsonPayload: unknown = await response.json()
        message = extractErrorMessage(jsonPayload)
      } catch {
        message = null
      }
    }

    if (!message) {
      try {
        const text = (await response.text()).trim()
        if (text) {
          message = text
        }
      } catch {
        message = null
      }
    }

    throw new Error(message ?? `HTTP ${response.status}`)
  }

  return (await response.json()) as T
}
