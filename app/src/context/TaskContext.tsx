/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { Task, TaskAction } from '@/types/task'
import { createTask } from '@/utils/task'
import { calculateIceScore } from '@/utils/ice'
import { useLocalStorage } from '@/hooks/useLocalStorage'

type TaskState = {
  tasks: Task[]
}

type TaskContextValue = {
  tasks: Task[]
  dispatch: React.Dispatch<TaskAction>
}

export const TaskContext = createContext<TaskContextValue | null>(null)

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'ADD_TASK': {
      const newTask = createTask(action.payload.title, action.payload.description)
      return { tasks: [...state.tasks, newTask] }
    }
    case 'UPDATE_TASK': {
      return {
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id
            ? { ...task, ...action.payload.changes, updatedAt: new Date().toISOString() }
            : task,
        ),
      }
    }
    case 'UPDATE_ICE_MANUAL': {
      return {
        tasks: state.tasks.map((task) => {
          if (task.id !== action.payload.id) return task
          const impact = action.payload.impact ?? task.ice.impact
          const confidence = action.payload.confidence ?? task.ice.confidence
          const ease = action.payload.ease ?? task.ice.ease
          return {
            ...task,
            ice: {
              impact,
              confidence,
              ease,
              score: calculateIceScore(impact, confidence, ease),
              source: 'manual' as const,
              rationale: undefined,
            },
            updatedAt: new Date().toISOString(),
          }
        }),
      }
    }
    case 'UPDATE_ICE_AI': {
      const { id, impact, confidence, ease, rationale } = action.payload
      return {
        tasks: state.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                ice: {
                  impact,
                  confidence,
                  ease,
                  score: calculateIceScore(impact, confidence, ease),
                  rationale,
                  source: 'ai' as const,
                },
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      }
    }
    case 'DELETE_TASK': {
      return { tasks: state.tasks.filter((task) => task.id !== action.payload.id) }
    }
    case 'SET_TASKS': {
      return { tasks: action.payload.tasks }
    }
  }
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [storedTasks, setStoredTasks] = useLocalStorage<Task[]>('tasks', [])
  const [state, dispatch] = useReducer(taskReducer, { tasks: storedTasks })

  useEffect(() => {
    setStoredTasks(state.tasks)
  }, [state.tasks, setStoredTasks])

  return <TaskContext value={{ tasks: state.tasks, dispatch }}>{children}</TaskContext>
}
