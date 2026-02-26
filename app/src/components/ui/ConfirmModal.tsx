import Modal from '@/components/ui/Modal'

type ConfirmModalProps = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  variant: 'primary' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}

const confirmStyles: Record<string, string> = {
  primary: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md',
  destructive: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md',
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} maxWidth="sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-gray-600 mt-2">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          {cancelLabel}
        </button>
        <button onClick={onConfirm} className={confirmStyles[variant]}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
