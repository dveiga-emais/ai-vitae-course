/* eslint-disable react-refresh/only-export-components */
import { createContext } from 'react'
import type { ReactNode } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

type ApiKeyContextValue = {
  apiKey: string
  setApiKey: (key: string) => void
  clearApiKey: () => void
  hasApiKey: boolean
}

export const ApiKeyContext = createContext<ApiKeyContextValue | null>(null)

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useLocalStorage<string>('gemini_api_key', '')

  const clearApiKey = () => setApiKey('')
  const hasApiKey = apiKey.length > 0

  return (
    <ApiKeyContext value={{ apiKey, setApiKey, clearApiKey, hasApiKey }}>{children}</ApiKeyContext>
  )
}
