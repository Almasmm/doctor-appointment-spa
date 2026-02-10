import { describe, expect, it } from 'vitest'
import { http as mswHttp, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { http } from './http'

describe('http helper', () => {
  it('добавляет Content-Type и возвращает JSON при успешном ответе', async () => {
    server.use(
      mswHttp.get('http://127.0.0.1:3001/test-success', ({ request }) =>
        HttpResponse.json({
          ok: true,
          contentType: request.headers.get('Content-Type'),
        }),
      ),
    )

    const result = await http<{ ok: boolean; contentType: string | null }>('/test-success')

    expect(result.ok).toBe(true)
    expect(result.contentType).toBe('application/json')
  })

  it('пробрасывает message из JSON-ошибки', async () => {
    server.use(
      mswHttp.get('http://127.0.0.1:3001/test-json-error', () =>
        HttpResponse.json({ message: 'Слот уже занят' }, { status: 409 }),
      ),
    )

    await expect(http('/test-json-error')).rejects.toThrow('Слот уже занят')
  })

  it('использует текст ошибки, если JSON message отсутствует', async () => {
    server.use(
      mswHttp.get(
        'http://127.0.0.1:3001/test-text-error',
        () => new HttpResponse('Internal error', { status: 500 }),
      ),
    )

    await expect(http('/test-text-error')).rejects.toThrow('Internal error')
  })

  it('поддерживает абсолютный URL без префикса API_BASE', async () => {
    server.use(
      mswHttp.get('https://example.com/ping', () =>
        HttpResponse.json({
          pong: true,
        }),
      ),
    )

    const result = await http<{ pong: boolean }>('https://example.com/ping')

    expect(result).toEqual({ pong: true })
  })
})
