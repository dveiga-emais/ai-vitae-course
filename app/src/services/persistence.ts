import type { Task } from '@/types/task'

export type PersistenceAdapter = {
  loadTasks: () => Promise<Task[]>
  saveTasks: (tasks: Task[]) => Promise<void>
  loadApiKey: () => Promise<string>
  saveApiKey: (key: string) => Promise<void>
  clearApiKey: () => Promise<void>
  subscribe?: (handler: () => void) => () => void
}

let adapter: PersistenceAdapter

export function setPersistenceAdapter(next: PersistenceAdapter) {
  adapter = next
}

export function getPersistenceAdapter(): PersistenceAdapter {
  if (!adapter) throw new Error('Persistence adapter not initialized')
  return adapter
}
