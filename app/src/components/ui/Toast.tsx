import { useEffect, useRef } from 'react'

type ToastProps = {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

const toastStyles: Record<string, string> = {
  success: 'bg-green-50 text-green-800 border border-green-200',
  error: 'bg-red-50 text-red-800 border border-red-200',
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const duration = type === 'success' ? 3000 : 5000
    timerRef.current = setTimeout(() => {
      onClose()
    }, duration)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [type, onClose])

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${toastStyles[type]}`}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        className="text-current opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  )
}
