import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockDb } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  resetMockDb()
  window.localStorage.clear()
})

afterAll(() => {
  server.close()
})
