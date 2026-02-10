import { useEffect, type PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { store } from '@/app/store'
import { initFromStorage, loadPersistedAuth } from '@/features/auth/model'

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const persistedAuth = loadPersistedAuth()
    if (persistedAuth) {
      store.dispatch(initFromStorage(persistedAuth))
    }
  }, [])

  return <Provider store={store}>{children}</Provider>
}
