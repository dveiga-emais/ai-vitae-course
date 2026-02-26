import type { PersistenceAdapter } from './persistence'
import type { Task } from '@/types/task'

const TASKS_KEY = 'tasks'
const API_KEY = 'gemini_api_key'

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const localStorageAdapter: PersistenceAdapter = {
  async loadTasks(): Promise<Task[]> {
    return safeParse<Task[]>(localStorage.getItem(TASKS_KEY), [])
  },
  async saveTasks(tasks: Task[]): Promise<void> {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  },
  async loadApiKey(): Promise<string> {
    return safeParse<string>(localStorage.getItem(API_KEY), '')
  },
  async saveApiKey(key: string): Promise<void> {
    localStorage.setItem(API_KEY, JSON.stringify(key))
  },
  async clearApiKey(): Promise<void> {
    localStorage.removeItem(API_KEY)
  },
  subscribe(handler) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TASKS_KEY || event.key === API_KEY) handler()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}
