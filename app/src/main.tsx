import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setPersistenceAdapter } from '@/services/persistence'
import { localStorageAdapter } from '@/services/persistence.localStorage'
import './index.css'
import App from './App.tsx'

setPersistenceAdapter(localStorageAdapter)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
