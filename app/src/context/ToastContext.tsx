/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from 'react'
import type { ReactNode } from 'react'
import Toast from '@/components/ui/Toast'

type ToastData = { message: string; type: 'success' | 'error' }

export type ToastContextValue = {
  toast: ToastData | null
  showToast: (message: string, type: 'success' | 'error') => void
  dismissToast: () => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const dismissToast = () => {
    setToast(null)
  }

  return (
    <ToastContext.Provider value={{ toast, showToast, dismissToast }}>
      {children}
      {toast !== null && (
        <div className="fixed top-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        </div>
      )}
    </ToastContext.Provider>
  )
}
