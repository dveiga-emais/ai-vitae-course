import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  maxWidth?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-[384px]',
  md: 'max-w-[448px]',
  lg: 'max-w-[512px]',
}

export default function Modal({ isOpen, onClose, maxWidth = 'md', children }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`bg-white rounded-lg shadow-xl ${maxWidthClasses[maxWidth]} w-full mx-4 p-6 relative`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
