import { useContext } from 'react'
import { ApiKeyContext } from '@/context/ApiKeyContext'

export function useApiKey() {
  const context = useContext(ApiKeyContext)
  if (!context) throw new Error('useApiKey must be used within ApiKeyProvider')
  return context
}
