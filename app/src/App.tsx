import { ToastProvider } from '@/context/ToastContext'
import { ApiKeyProvider } from '@/context/ApiKeyContext'
import { TaskProvider } from '@/context/TaskContext'
import { useApiKey } from '@/hooks/useApiKey'

function App() {
  return (
    <ToastProvider>
      <ApiKeyProvider>
        <TaskProvider>
          <AppContent />
        </TaskProvider>
      </ApiKeyProvider>
    </ToastProvider>
  )
}

function AppContent() {
  const { hasApiKey } = useApiKey()
  return hasApiKey ? <MainView /> : <ApiKeySetup />
}

function MainView() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-blue-600">Gestor de Tareas ICE</h1>
    </div>
  )
}

function ApiKeySetup() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-600">Configurar API Key</h1>
    </div>
  )
}

export default App
