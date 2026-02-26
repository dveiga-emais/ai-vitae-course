import type { Task } from '@/types/task'

/**
 * Crea una nueva tarea con valores por defecto.
 */
export function createTask(title: string, description?: string): Task {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title,
    description,
    status: 'backlog',
    createdAt: now,
    updatedAt: now,
    ice: {},
  }
}

/**
 * Devuelve true si la tarea tiene al menos un valor I/C/E definido.
 */
export function hasAnyIce(task: Task): boolean {
  const { impact, confidence, ease } = task.ice
  return impact !== undefined || confidence !== undefined || ease !== undefined
}

/**
 * Devuelve true si la tarea tiene los tres valores I/C/E definidos.
 */
export function hasCompleteIce(task: Task): boolean {
  const { impact, confidence, ease } = task.ice
  return impact !== undefined && confidence !== undefined && ease !== undefined
}
