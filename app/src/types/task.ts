// --- Tipos de dominio ---

export type TaskStatus = 'backlog' | 'doing' | 'done'

export type IceScore = {
  impact?: number // 0..100, entero. undefined = sin definir
  confidence?: number // 0..100, entero. undefined = sin definir
  ease?: number // 0..100, entero. undefined = sin definir
  score?: number // Math.round((I+C+E)/3). undefined si falta alguno
  rationale?: string // Justificacion IA (1-2 frases)
  source?: 'manual' | 'ai'
}

export type Task = {
  id: string // crypto.randomUUID()
  title: string
  description?: string
  status: TaskStatus
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  ice: IceScore
}

// --- Acciones del reducer ---

export type TaskAction =
  | { type: 'ADD_TASK'; payload: { title: string; description?: string } }
  | {
      type: 'UPDATE_TASK'
      payload: {
        id: string
        changes: Partial<Pick<Task, 'title' | 'description' | 'status'>>
      }
    }
  | {
      type: 'UPDATE_ICE_MANUAL'
      payload: {
        id: string
        impact?: number
        confidence?: number
        ease?: number
      }
    }
  | {
      type: 'UPDATE_ICE_AI'
      payload: {
        id: string
        impact: number
        confidence: number
        ease: number
        rationale: string
      }
    }
  | { type: 'DELETE_TASK'; payload: { id: string } }
  | { type: 'SET_TASKS'; payload: { tasks: Task[] } }
